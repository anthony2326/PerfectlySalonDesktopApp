"use client"

import { useState, useEffect } from "react"
import Sidebar from "../../components/Sidebar/Sidebar"
import styles from "./Scheduling.module.css"
import supabase from "../../../../utils/supabase"

const Bookings = ({ logoSrc, logoAlt = "Logo", onNavigate, onLogout }) => {
  const [bookings, setBookings] = useState([])
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [filterStatus, setFilterStatus] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState("grid")

  // Product management states
  const [inventory, setInventory] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [showProductModal, setShowProductModal] = useState(false)
  const [appointmentProducts, setAppointmentProducts] = useState({})

  const [bookingWizardVisible, setBookingWizardVisible] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedServices, setSelectedServices] = useState({})
  const [selectedAddons, setSelectedAddons] = useState({}) // Track selected add-ons
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [selectedTime, setSelectedTime] = useState("10:00")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedPayment, setSelectedPayment] = useState("cash")
  const [bookingClientName, setBookingClientName] = useState("")
  const [bookingClientPhone, setBookingClientPhone] = useState("")
  const [bookingClientEmail, setBookingClientEmail] = useState("")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [successModalVisible, setSuccessModalVisible] = useState(false)
  const [successBookingData, setSuccessBookingData] = useState(null)
  const [servicesByCategory, setServicesByCategory] = useState({})
  const [categoryAddons, setCategoryAddons] = useState({}) // Store add-ons by category
  const [clients, setClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(false)

  useEffect(() => {
    fetchBookings()
    fetchInventory()
    fetchServices()
    fetchClients()

    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    const subscription = supabase
      .channel("appointments-admin-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          console.log("[REALTIME] Database change detected:", payload)
          fetchBookings()
        },
      )
      .subscribe((status) => {
        console.log("[REALTIME] Subscription status:", status)
      })

    return () => {
      clearInterval(clockInterval)
      console.log("[REALTIME] Unsubscribing from appointments changes")
      supabase.removeChannel(subscription)
    }
  }, [])

  // Auto-cancel CONFIRMED appointments that are 1 hour past their scheduled time
  useEffect(() => {
    const checkAndCancelOverdueAppointments = async () => {
      const now = new Date()

      for (const booking of bookings) {
        if (booking.status !== "confirmed") {
          continue
        }

        try {
          let appointmentDateTime

          if (booking.date.includes("-")) {
            const timePart = booking.time.replace(/\s*(AM|PM)\s*/i, "").trim()
            appointmentDateTime = new Date(`${booking.date}T${timePart}`)

            if (booking.time.match(/PM/i) && !booking.time.startsWith("12")) {
              const hours = Number.parseInt(timePart.split(":")[0])
              appointmentDateTime.setHours(hours + 12)
            } else if (booking.time.match(/AM/i) && booking.time.startsWith("12")) {
              appointmentDateTime.setHours(0)
            }
          } else {
            appointmentDateTime = new Date(`${booking.date} ${booking.time}`)
          }

          if (isNaN(appointmentDateTime.getTime())) {
            console.error(`[AUTO-CANCEL] Invalid date/time for booking ${booking.id}`, {
              date: booking.date,
              time: booking.time,
            })
            continue
          }

          const oneHourInMs = 60 * 60 * 1000
          const cancelThreshold = new Date(appointmentDateTime.getTime() + oneHourInMs)

          if (Math.random() < 0.1) {
            console.log(`[AUTO-CANCEL CHECK] Booking ${booking.id} - ${booking.clientName}:`, {
              appointmentDate: booking.date,
              appointmentTime: booking.time,
              parsedDateTime: appointmentDateTime.toLocaleString(),
              cancelAfter: cancelThreshold.toLocaleString(),
              currentTime: now.toLocaleString(),
              hoursUntilCancel: ((cancelThreshold - now) / (60 * 60 * 1000)).toFixed(2),
            })
          }

          if (now > cancelThreshold) {
            console.log(`[AUTO-CANCEL] ⚠️ Cancelling overdue booking ${booking.id} - ${booking.clientName}`)

            const { error } = await supabase
              .from("appointments")
              .update({
                status: "cancelled",
                notes: `${booking.notes}\n\n[AUTO-CANCELLED on ${now.toLocaleString()}: Customer did not arrive within 1 hour of scheduled time ${appointmentDateTime.toLocaleString()}]`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", booking.id)

            if (error) {
              console.error(`[AUTO-CANCEL ERROR] Failed to cancel booking ${booking.id}:`, error)
            } else {
              console.log(`[AUTO-CANCEL SUCCESS] ✅ Booking ${booking.id} cancelled automatically`)

              await createNotification(
                booking.clientEmail,
                booking.id,
                "Appointment Auto-Cancelled",
                `Your appointment scheduled for ${booking.date} at ${booking.time} was automatically cancelled due to no-show. Please contact us to reschedule.`,
                "cancelled",
              )

              await fetchBookings()
            }
          }
        } catch (err) {
          console.error(`[AUTO-CANCEL ERROR] Exception for booking ${booking.id}:`, err)
        }
      }
    }

    const timeoutId = setTimeout(() => {
      if (bookings.length > 0) {
        checkAndCancelOverdueAppointments()
      }
    }, 5000)

    const intervalId = setInterval(() => {
      if (bookings.length > 0) {
        checkAndCancelOverdueAppointments()
      }
    }, 60000)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [bookings])

  const createNotification = async (userEmail, appointmentId, title, description, type) => {
    try {
      console.log("[NOTIFICATION] Creating notification with data:", {
        userEmail,
        appointmentId,
        title,
        description,
        type,
      })

      if (!userEmail) {
        console.error("[NOTIFICATION] ❌ Missing user email")
        return false
      }

      const notificationData = {
        user_email: userEmail,
        appointment_id: appointmentId,
        title: title,
        description: description,
        type: type,
        is_read: false,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from("notifications").insert(notificationData).select().single()

      if (error) {
        console.error("[NOTIFICATION] ❌ Error creating notification:", error)
        return false
      }

      console.log("[NOTIFICATION] ✅ Notification created successfully:", data)
      return true
    } catch (err) {
      console.error("[NOTIFICATION] ❌ Exception creating notification:", err)
      return false
    }
  }

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase.from("inventory").select("*").order("category").order("name")

      if (error) throw error

      setInventory(data || [])
    } catch (err) {
      console.error("[ERROR] Failed to fetch inventory:", err)
    }
  }

  const fetchServices = async () => {
    try {
      console.log("[DEBUG] Starting fetchServices...")

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("service_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order")

      if (categoriesError) {
        console.error("[ERROR] Categories fetch error:", categoriesError)
        throw categoriesError
      }

      console.log("[DEBUG] Categories fetched:", categoriesData)

      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("display_order")

      if (servicesError) {
        console.error("[ERROR] Services fetch error:", servicesError)
        throw servicesError
      }

      console.log("[DEBUG] Services fetched:", servicesData)

      const { data: addonsData, error: addonsError } = await supabase
        .from("service_addons")
        .select("*")
        .eq("is_active", true)
        .order("display_order")

      if (addonsError) {
        console.error("[ERROR] Add-ons fetch error:", addonsError)
      }

      // Group services by category name
      const grouped = {}
      const addons = {}
      categoriesData?.forEach((category) => {
        const categoryServices = servicesData?.filter((s) => s.category_id === category.id) || []
        grouped[category.name] = categoryServices
        const categoryAddonsData = addonsData?.filter((a) => a.category_id === category.id) || []
        addons[category.name] = categoryAddonsData
        console.log(`[DEBUG] Category "${category.name}" has ${categoryServices.length} services`)
      })

      console.log("[DEBUG] Final grouped services:", grouped)
      console.log("[DEBUG] Final grouped add-ons:", addons)
      setServicesByCategory(grouped)
      setCategoryAddons(addons)
    } catch (err) {
      console.error("[ERROR] Failed to fetch services:", err)
      setServicesByCategory({})
    }
  }

  const fetchClients = async () => {
    try {
      setLoadingClients(true)
      const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

      if (error) throw error

      console.log("[DEBUG] Fetched clients from users table:", data)
      setClients(data || [])
    } catch (err) {
      console.error("[ERROR] Failed to fetch clients:", err)
    } finally {
      setLoadingClients(false)
    }
  }

  const fetchAppointmentProducts = async (appointmentId) => {
    try {
      const { data, error } = await supabase
        .from("appointment_products")
        .select(`*,
          inventory:product_id (
            id,
            name,
            category,
            quantity,
            unit
          )
        `)
        .eq("appointment_id", appointmentId)

      if (error) throw error

      return data || []
    } catch (err) {
      console.error("[ERROR] Failed to fetch appointment products:", err)
      return []
    }
  }

  const fetchBookings = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.from("appointments").select("*").order("created_at", { ascending: false })

      const transformedBookings = data.map((booking) => ({
        id: booking.id,
        clientName: booking.client_name || "N/A",
        clientPhone: booking.client_phone || "N/A",
        clientEmail: booking.client_email || "N/A",
        service: Array.isArray(booking.services)
          ? booking.services.map((s) => s.name || s).join(", ")
          : typeof booking.services === "string"
            ? booking.services
            : "N/A",
        stylist: booking.stylist || "N/A",
        date: booking.appointment_date,
        time: booking.appointment_time,
        duration: booking.duration || "N/A",
        price: booking.total_amount ? `₱${Number.parseFloat(booking.total_amount).toFixed(2)}` : "₱0.00",
        status: booking.status || "pending",
        notes: booking.notes || "No notes",
        orderNumber: booking.order_number,
        paymentMethod: booking.payment_method,
      }))

      setBookings(transformedBookings)

      const productsData = {}
      for (const booking of transformedBookings) {
        const products = await fetchAppointmentProducts(booking.id)
        productsData[booking.id] = products
      }
      setAppointmentProducts(productsData)
    } catch (err) {
      console.error("[ERROR] Exception in fetchBookings:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenProductModal = async (booking) => {
    setSelectedBooking(booking)

    const existingProducts = await fetchAppointmentProducts(booking.id)

    setSelectedProducts(
      existingProducts.map((p) => ({
        product_id: p.product_id,
        quantity_used: p.quantity_used,
        name: p.inventory?.name || "Unknown",
      })),
    )

    setShowProductModal(true)
  }

  const handleAddProduct = () => {
    setSelectedProducts([...selectedProducts, { product_id: "", quantity_used: 1, name: "" }])
  }

  const handleRemoveProduct = (index) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index))
  }

  const handleProductChange = (index, field, value) => {
    const updated = [...selectedProducts]
    updated[index][field] = value

    if (field === "product_id") {
      const product = inventory.find((p) => p.id === Number.parseInt(value))
      updated[index].name = product?.name || ""
    }

    setSelectedProducts(updated)
  }

  const handleSaveProducts = async () => {
    if (!selectedBooking) return

    try {
      setUpdating(true)

      await supabase.from("appointment_products").delete().eq("appointment_id", selectedBooking.id)

      if (selectedProducts.length > 0) {
        const productsToInsert = selectedProducts
          .filter((p) => p.product_id && p.quantity_used > 0)
          .map((p) => ({
            appointment_id: selectedBooking.id,
            product_id: Number.parseInt(p.product_id),
            quantity_used: Number.parseInt(p.quantity_used),
          }))

        if (productsToInsert.length > 0) {
          const { error } = await supabase.from("appointment_products").insert(productsToInsert)

          if (error) throw error
        }
      }

      alert("✅ Products updated successfully!")
      setShowProductModal(false)
      await fetchBookings()
    } catch (err) {
      console.error("[ERROR] Failed to save products:", err)
      alert(`❌ Failed to save products: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  const updateBookingStatus = async (bookingId, newStatus) => {
    if (updating) return

    if (newStatus === "completed") {
      const products = appointmentProducts[bookingId] || []
      if (products.length === 0) {
        const confirmComplete = window.confirm(
          "⚠️ No products are assigned to this appointment. Inventory will not be deducted. Continue?",
        )
        if (!confirmComplete) return
      }
    }

    try {
      setUpdating(true)
      console.log("=== UPDATE BOOKING STATUS START ===")
      console.log("[DEBUG] Booking ID:", bookingId)
      console.log("[DEBUG] New Status:", newStatus)

      const booking = bookings.find((b) => b.id === bookingId)
      console.log("[DEBUG] Found booking:", booking)

      if (!booking) {
        throw new Error("Booking not found")
      }

      if (!booking.clientEmail) {
        console.error("[ERROR] No client email found for booking:", booking)
      }

      const { data: updatedData, error: updateError } = await supabase
        .from("appointments")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select()
        .single()

      if (updateError) {
        throw new Error(updateError.message || "Failed to update booking")
      }

      if (!updatedData) {
        throw new Error("No data returned from update")
      }

      console.log("[SUCCESS] Booking updated successfully!")

      if (booking.clientEmail) {
        let notificationTitle = ""
        let notificationDescription = ""
        const notificationType = newStatus

        switch (newStatus) {
          case "confirmed":
            notificationTitle = "Booking Confirmed! 🎉"
            notificationDescription = `Your appointment for ${booking.service} on ${booking.date} at ${booking.time} has been confirmed. We look forward to seeing you!`
            break

          case "cancelled":
            notificationTitle = "Booking Cancelled"
            notificationDescription = `Your appointment for ${booking.service} scheduled on ${booking.date} at ${booking.time} has been cancelled. Please contact us if you have any questions.`
            break

          case "completed":
            notificationTitle = "Service Completed! ✨"
            notificationDescription = `Thank you for visiting us! Your ${booking.service} appointment on ${booking.date} has been completed. We hope to see you again soon!`
            break

          default:
            notificationTitle = "Booking Status Updated"
            notificationDescription = `Your appointment status has been updated to: ${newStatus}`
        }

        console.log("[NOTIFICATION] About to create notification for:", booking.clientEmail)
        const notificationCreated = await createNotification(
          booking.clientEmail,
          bookingId,
          notificationTitle,
          notificationDescription,
          notificationType,
        )

        if (notificationCreated) {
          console.log("[NOTIFICATION] ✅ Notification sent successfully")
        } else {
          console.error("[NOTIFICATION] ❌ Failed to send notification")
        }
      } else {
        console.error("[NOTIFICATION] ❌ Cannot create notification - no client email")
      }

      setBookings((prevBookings) => prevBookings.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b)))

      if (selectedBooking?.id === bookingId) {
        setSelectedBooking((prev) => ({ ...prev, status: newStatus }))
      }

      if (newStatus === "completed") {
        alert(`✅ Booking completed! Inventory has been automatically updated.`)
      } else {
        alert(`✅ Booking status updated to: ${newStatus}`)
      }

      await fetchBookings()
      await fetchInventory()

      setSelectedBooking(null)

      console.log("=== UPDATE BOOKING STATUS END ===")
    } catch (err) {
      console.error("=== UPDATE BOOKING STATUS ERROR ===")
      console.error("[ERROR] Exception in updateBookingStatus:", err)
      alert(`❌ Failed to update booking: ${err.message}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleApprove = (bookingId) => {
    console.log("[ACTION] Confirm button clicked for booking:", bookingId)
    updateBookingStatus(bookingId, "confirmed")
  }

  const handleCancel = (bookingId) => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      console.log("[ACTION] Cancel confirmed for booking:", bookingId)
      updateBookingStatus(bookingId, "cancelled")
    }
  }

  const handleComplete = (bookingId) => {
    console.log("[ACTION] Complete button clicked for booking:", bookingId)
    updateBookingStatus(bookingId, "completed")
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return styles.statusPending
      case "confirmed":
        return styles.statusApproved
      case "completed":
        return styles.statusCompleted
      case "cancelled":
        return styles.statusCancelled
      default:
        return ""
    }
  }

  const filteredBookings =
    filterStatus === "all" ? bookings : bookings.filter((booking) => booking.status === filterStatus)

  const searchFilteredBookings = filteredBookings.filter((booking) =>
    booking.clientName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const bookingStats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  }

  const openBookingWizard = () => {
    setWizardStep(1)
    setSelectedCategory(null)
    setSelectedServices({})
    setSelectedAddons({}) // Reset add-ons
    setSelectedDate(new Date().toISOString().split("T")[0])
    setSelectedTime("10:00")
    setSelectedPayment("cash")
    setBookingClientName("")
    setBookingClientPhone("")
    setBookingClientEmail("")
    setCurrentMonth(new Date())
    setSelectedClientId(null)
    setBookingWizardVisible(true)
  }

  const closeBookingWizard = () => {
    setBookingWizardVisible(false)
    setWizardStep(1)
    setSelectedCategory(null)
    setSelectedServices({})
    setSelectedAddons({}) // Reset add-ons
    setSelectedDate(new Date().toISOString().split("T")[0])
    setSelectedTime("10:00")
    setSelectedPayment("cash")
    setBookingClientName("")
    setBookingClientPhone("")
    setBookingClientEmail("")
    setSelectedClientId(null)
  }

  const handleSelectClient = (client) => {
    setSelectedClientId(client.id)
    setBookingClientName(client.name || "")
    setBookingClientPhone(client.contact_number || "")
    setBookingClientEmail(client.email || "")
  }

  const generateOrderNumber = () => {
    return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  }

  const formatTime = (time) => {
    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const generateTimeSlots = () => {
    const slots = []
    const startHour = 10
    const endHour = 19 // 7 PM in 24-hour format

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
        slots.push(timeStr)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  const isTimeSlotBooked = (time) => {
    if (!selectedDate) return false

    const formattedTime = formatTime(time)

    return bookings.some(
      (booking) =>
        booking.date === selectedDate &&
        booking.time === formattedTime &&
        (booking.status === "pending" || booking.status === "confirmed"),
    )
  }

  const handleCompleteBooking = async () => {
    try {
      const selectedServicesList = Object.entries(selectedServices).map(([serviceId, qty]) => {
        const categoryServices = servicesByCategory[selectedCategory] || []
        const service = categoryServices.find((s) => String(s.id) === String(serviceId))

        return {
          id: String(serviceId),
          name: service?.name || "Unknown Service",
          price: Number.parseFloat(service?.price) || 0,
          quantity: qty,
        }
      })

      const selectedAddonsList = Object.entries(selectedAddons).map(([addonId, qty]) => {
        const addons = categoryAddons[selectedCategory] || []
        const addon = addons.find((a) => String(a.id) === String(addonId))
        return {
          id: String(addonId),
          name: addon?.name || "Unknown Add-on",
          price: Number.parseFloat(addon?.price) || 0,
          quantity: qty,
          isAddon: true,
        }
      })

      // Combine services and add-ons
      const allItems = [...selectedServicesList, ...selectedAddonsList]

      const totalPrice = allItems.reduce((sum, item) => {
        const itemPrice = Number.parseFloat(item.price) || 0
        const qty = Number.parseInt(item.quantity) || 1
        return sum + itemPrice * qty
      }, 0)

      const serviceNames = selectedServicesList.map((s) => `${s.name} (x${s.quantity})`).join(", ")
      const addonNames =
        selectedAddonsList.length > 0
          ? " + Add-ons: " + selectedAddonsList.map((a) => `${a.name} (x${a.quantity})`).join(", ")
          : ""

      const formattedTime = formatTime(selectedTime)
      const paymentMethodName = selectedPayment === "cash" ? "Cash" : selectedPayment === "card" ? "Card" : "Online"

      const appointmentData = {
        order_number: generateOrderNumber(),
        user_id: selectedClientId || null,
        client_name: bookingClientName.trim(),
        client_phone: bookingClientPhone.trim(),
        client_email: bookingClientEmail.trim(),
        appointment_date: selectedDate,
        appointment_time: formattedTime,
        payment_method: paymentMethodName,
        status: "pending",
        notes: `Payment Method: ${paymentMethodName}`,
        total_amount: totalPrice > 0 ? totalPrice : 0,
        services: allItems, // Save combined services and add-ons
        stylist: "Unassigned",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      console.log("[BOOKING] Appointment data:", appointmentData)

      const { data, error } = await supabase.from("appointments").insert([appointmentData]).select()

      if (error) {
        console.error("[BOOKING] Insert error:", error)
        alert("❌ Failed to create booking")
      } else {
        setSuccessBookingData({
          name: bookingClientName,
          date: selectedDate,
          time: formattedTime,
          services: serviceNames + addonNames,
          total: totalPrice,
          paymentMethod: paymentMethodName,
        })
        setSuccessModalVisible(true)
        setBookingWizardVisible(false)

        setSelectedCategory(null)
        setSelectedServices({})
        setSelectedAddons({})
        setSelectedDate(new Date().toISOString().split("T")[0])
        setSelectedTime("10:00")
        setSelectedPayment("cash")
        setBookingClientName("")
        setBookingClientPhone("")
        setBookingClientEmail("")
        setSelectedClientId(null)
        setWizardStep(1)

        await fetchBookings()
      }
    } catch (err) {
      console.error("[BOOKING] Error:", err)
      alert("❌ An error occurred while creating the booking")
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <Sidebar
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          currentPage="Scheduling"
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
        <div className={styles.mainContent}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading bookings...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Sidebar
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          currentPage="Scheduling"
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
        <div className={styles.mainContent}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>⚠️</div>
            <h3>Error Loading Bookings</h3>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={fetchBookings}>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Sidebar
        logoSrc={logoSrc}
        logoAlt={logoAlt}
        currentPage="Scheduling"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <div className={styles.mainContent}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Booking Management</h1>
          <p className={styles.welcomeMessage}>Manage all client bookings and appointments</p>
        </div>

        <button className={styles.addAppointmentBtn} onClick={openBookingWizard}>
          ➕ Add New Appointment
        </button>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📊</div>
            <div className={styles.statValue}>{bookingStats.total}</div>
            <div className={styles.statLabel}>Total Bookings</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⏳</div>
            <div className={styles.statValue}>{bookingStats.pending}</div>
            <div className={styles.statLabel}>Pending</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statValue}>{bookingStats.confirmed}</div>
            <div className={styles.statLabel}>Confirmed</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🎉</div>
            <div className={styles.statValue}>{bookingStats.completed}</div>
            <div className={styles.statLabel}>Completed</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🚫</div>
            <div className={styles.statValue}>{bookingStats.cancelled}</div>
            <div className={styles.statLabel}>Cancelled</div>
          </div>
        </div>

        <div className={styles.filterSection}>
          <button
            className={`${styles.filterButton} ${filterStatus === "all" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All Bookings ({bookingStats.total})
          </button>
          <button
            className={`${styles.filterButton} ${filterStatus === "pending" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilterStatus("pending")}
          >
            Pending ({bookingStats.pending})
          </button>
          <button
            className={`${styles.filterButton} ${filterStatus === "confirmed" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilterStatus("confirmed")}
          >
            Confirmed ({bookingStats.confirmed})
          </button>
          <button
            className={`${styles.filterButton} ${filterStatus === "completed" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilterStatus("completed")}
          >
            Completed ({bookingStats.completed})
          </button>
          <button
            className={`${styles.filterButton} ${filterStatus === "cancelled" ? styles.filterButtonActive : ""}`}
            onClick={() => setFilterStatus("cancelled")}
          >
            Cancelled ({bookingStats.cancelled})
          </button>
        </div>

        <div className={styles.controlsSection}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              placeholder="Search by client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <span className={styles.searchIcon}>🔍</span>
          </div>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewButton} ${viewMode === "grid" ? styles.viewButtonActive : ""}`}
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              ⊞ Grid
            </button>
            <button
              className={`${styles.viewButton} ${viewMode === "list" ? styles.viewButtonActive : ""}`}
              onClick={() => setViewMode("list")}
              title="List View"
            >
              ≡ List
            </button>
          </div>
        </div>

        <div className={styles.bookingsLayout}>
          <div className={styles.bookingsSidebar}>
            <h3 className={styles.sidebarTitle}>Client Bookings</h3>
            <div className={`${styles.bookingsList} ${viewMode === "list" ? styles.bookingsListView : ""}`}>
              {searchFilteredBookings.length === 0 ? (
                <div className={styles.emptyBookings}>
                  <p>
                    No {filterStatus !== "all" ? filterStatus : ""} bookings found
                    {searchQuery ? " matching your search" : ""}
                  </p>
                </div>
              ) : (
                searchFilteredBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={`${styles.bookingCard} ${selectedBooking?.id === booking.id ? styles.bookingCardActive : ""}`}
                    onClick={() => setSelectedBooking(booking)}
                  >
                    {viewMode === "grid" ? (
                      <>
                        <div className={styles.bookingCardHeader}>
                          <div className={styles.clientName}>{booking.clientName}</div>
                          <span className={`${styles.statusBadge} ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className={styles.bookingCardInfo}>
                          <div className={styles.infoRow}>
                            <span className={styles.infoIcon}>📅</span>
                            <span>
                              {booking.date} at {booking.time}
                            </span>
                          </div>
                          <div className={styles.infoRow}>
                            <span className={styles.infoIcon}>✂️</span>
                            <span>{booking.service}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span className={styles.infoIcon}>👤</span>
                            <span>{booking.stylist}</span>
                          </div>
                          {appointmentProducts[booking.id]?.length > 0 && (
                            <div className={styles.infoRow}>
                              <span className={styles.infoIcon}>📦</span>
                              <span>{appointmentProducts[booking.id].length} product(s)</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className={styles.bookingListRow}>
                        <div className={styles.listColumn} style={{ flex: "1.5" }}>
                          <span className={styles.columnLabel}>Name</span>
                          <span className={styles.columnValue}>{booking.clientName}</span>
                        </div>
                        <div className={styles.listColumn}>
                          <span className={styles.columnLabel}>Date & Time</span>
                          <span className={styles.columnValue}>
                            {booking.date} {booking.time}
                          </span>
                        </div>
                        <div className={styles.listColumn} style={{ flex: "1.2" }}>
                          <span className={styles.columnLabel}>Service</span>
                          <span className={styles.columnValue}>{booking.service}</span>
                        </div>
                        <div className={styles.listColumn}>
                          <span className={styles.columnLabel}>Stylist</span>
                          <span className={styles.columnValue}>{booking.stylist}</span>
                        </div>
                        <div className={styles.listColumn} style={{ flex: "0.8" }}>
                          <span className={styles.columnLabel}>Status</span>
                          <span className={`${styles.statusBadge} ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && !showProductModal && (
        <div className={styles.detailsPanel}>
          <div>
            <button className={styles.closeModal} onClick={() => setSelectedBooking(null)} aria-label="Close">
              ×
            </button>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Booking Details</h2>
              <span className={`${styles.statusBadgeLarge} ${getStatusColor(selectedBooking.status)}`}>
                {selectedBooking.status}
              </span>
            </div>

            <div className={styles.detailsContent}>
              <div className={styles.detailsSection}>
                <h3 className={styles.sectionTitle}>Client Information</h3>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Service</span>
                    <span className={styles.detailValue}>{selectedBooking.service}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Stylist</span>
                    <span className={styles.detailValue}>{selectedBooking.stylist}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Date</span>
                    <span className={styles.detailValue}>{selectedBooking.date}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Time</span>
                    <span className={styles.detailValue}>{selectedBooking.time}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Duration</span>
                    <span className={styles.detailValue}>{selectedBooking.duration}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Price</span>
                    <span className={styles.detailValue}>{selectedBooking.price}</span>
                  </div>
                </div>
              </div>

              <div className={styles.detailsSection}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "20px",
                  }}
                >
                  <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                    Products Used
                  </h3>
                  {selectedBooking.status !== "completed" && selectedBooking.status !== "cancelled" && (
                    <button
                      className={styles.manageProductsBtn}
                      onClick={() => handleOpenProductModal(selectedBooking)}
                    >
                      📦 Manage Products
                    </button>
                  )}
                </div>
                {appointmentProducts[selectedBooking.id]?.length > 0 ? (
                  <div className={styles.productsList}>
                    {appointmentProducts[selectedBooking.id].map((product, index) => (
                      <div key={index} className={styles.productItem}>
                        <span className={styles.productName}>{product.inventory?.name || "Unknown Product"}</span>
                        <span className={styles.productQuantity}>
                          Qty: {product.quantity_used} {product.inventory?.unit || "unit"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noProductsText}>
                    {selectedBooking.status === "completed"
                      ? "⚠️ No products were assigned to this appointment"
                      : "No products assigned yet. Click 'Manage Products' to add."}
                  </p>
                )}
              </div>

              <div className={styles.detailsSection}>
                <h3 className={styles.sectionTitle}>Notes</h3>
                <p className={styles.notesText}>{selectedBooking.notes}</p>
              </div>

              <div className={styles.actionsSection}>
                {selectedBooking.status === "pending" && (
                  <>
                    <button
                      className={`${styles.actionBtn} ${styles.approveBtn}`}
                      onClick={() => handleApprove(selectedBooking.id)}
                      disabled={updating}
                    >
                      <span className={styles.btnIcon}>✅</span>
                      {updating ? "Updating..." : "Confirm Booking"}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.cancelBtn}`}
                      onClick={() => handleCancel(selectedBooking.id)}
                      disabled={updating}
                    >
                      <span className={styles.btnIcon}>❌</span>
                      Cancel Booking
                    </button>
                  </>
                )}
                {selectedBooking.status === "confirmed" && (
                  <>
                    <button
                      className={`${styles.actionBtn} ${styles.completeBtn}`}
                      onClick={() => handleComplete(selectedBooking.id)}
                      disabled={updating}
                    >
                      <span className={styles.btnIcon}>🎉</span>
                      {updating ? "Updating..." : "Mark as Completed"}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.cancelBtn}`}
                      onClick={() => handleCancel(selectedBooking.id)}
                      disabled={updating}
                    >
                      <span className={styles.btnIcon}>❌</span>
                      Cancel Booking
                    </button>
                  </>
                )}
                {selectedBooking.status === "completed" && (
                  <div className={styles.completedMessage}>
                    <span className={styles.completedIcon}>✨</span>
                    This booking has been completed
                  </div>
                )}
                {selectedBooking.status === "cancelled" && (
                  <div className={styles.cancelledMessage}>
                    <span className={styles.cancelledIcon}>🚫</span>
                    This booking has been cancelled
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Management Modal */}
      {showProductModal && selectedBooking && (
        <div className={styles.detailsPanel}>
          <div>
            <button className={styles.closeModal} onClick={() => setShowProductModal(false)} aria-label="Close">
              ×
            </button>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>Manage Products</h2>
            </div>

            <div className={styles.detailsContent}>
              <div className={styles.detailsSection}>
                <p style={{ textAlign: "center", color: "#6b7280", marginBottom: "20px" }}>
                  Select products that will be used for this appointment. Inventory will be automatically deducted when
                  the appointment is completed.
                </p>

                <div className={styles.productsForm}>
                  {selectedProducts.map((product, index) => (
                    <div key={index} className={styles.productFormRow}>
                      <select
                        value={product.product_id}
                        onChange={(e) => handleProductChange(index, "product_id", e.target.value)}
                        className={styles.productSelect}
                      >
                        <option value="">Select Product...</option>
                        {inventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.quantity} {item.unit} available)
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        value={product.quantity_used}
                        onChange={(e) => handleProductChange(index, "quantity_used", e.target.value)}
                        className={styles.quantityInput}
                        placeholder="Qty"
                      />

                      <button
                        onClick={() => handleRemoveProduct(index)}
                        className={styles.removeProductBtn}
                        title="Remove"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  <button onClick={handleAddProduct} className={styles.addProductBtn}>
                    ➕ Add Product
                  </button>
                </div>
              </div>

              <div className={styles.actionsSection}>
                <button
                  className={`${styles.actionBtn} ${styles.cancelBtn}`}
                  onClick={() => setShowProductModal(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.approveBtn}`}
                  onClick={handleSaveProducts}
                  disabled={updating}
                >
                  <span className={styles.btnIcon}>💾</span>
                  {updating ? "Saving..." : "Save Products"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bookingWizardVisible && (
        <div className={styles.detailsPanel}>
          <div>
            <button className={styles.closeModal} onClick={closeBookingWizard} aria-label="Close">
              ×
            </button>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>
                {wizardStep === 1 && "Select Service Category"}
                {wizardStep === 2 && "Select Services"}
                {wizardStep === 3 && "Select Date & Time"}
                {wizardStep === 4 && "Select Payment Method"}
                {wizardStep === 5 && "Client Information"}
              </h2>
            </div>

            <div className={styles.detailsContent}>
              {/* Step 1: Category Selection */}
              {wizardStep === 1 && (
                <div className={styles.detailsSection}>
                  {Object.keys(servicesByCategory).length === 0 ? (
                    <div
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#ef4444",
                        width: "100%",
                        maxWidth: "600px",
                      }}
                    >
                      <p style={{ fontSize: "18px", fontWeight: "600", marginBottom: "10px" }}>
                        ⚠️ No service categories found
                      </p>
                      <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
                        Please check the browser console for errors and verify:
                        <br />
                        1. Categories exist in database
                        <br />
                        2. Services are linked to categories
                        <br />
                        3. RLS policies allow reading
                      </p>
                      <button
                        onClick={() => {
                          console.log("[DEBUG] Manual refresh triggered")
                          fetchServices()
                        }}
                        style={{
                          padding: "10px 20px",
                          background: "#db2777",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                      >
                        🔄 Retry Loading Services
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "15px",
                        width: "100%",
                        maxWidth: "600px",
                      }}
                    >
                      {Object.keys(servicesByCategory).map((category) => {
                        const serviceCount = servicesByCategory[category]?.length || 0
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              console.log(`[DEBUG] Selected category: ${category}`)
                              console.log(`[DEBUG] Services in category:`, servicesByCategory[category])
                              setSelectedCategory(category)
                              setWizardStep(2)
                            }}
                            style={{
                              padding: "20px",
                              border: "2px solid #fbcfe8",
                              borderRadius: "8px",
                              background: selectedCategory === category ? "#db2777" : "#fce7f3",
                              color: selectedCategory === category ? "white" : "#1f2937",
                              cursor: "pointer",
                              fontWeight: "600",
                              transition: "all 0.3s ease",
                              position: "relative",
                            }}
                          >
                            <div>{category}</div>
                            <div
                              style={{
                                fontSize: "11px",
                                marginTop: "5px",
                                opacity: 0.8,
                              }}
                            >
                              {serviceCount} service{serviceCount !== 1 ? "s" : ""}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Service and Add-ons Selection */}
              {wizardStep === 2 && (
                <div className={styles.detailsSection}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      width: "100%",
                      maxWidth: "600px",
                    }}
                  >
                    {/* Services */}
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1f2937",
                        marginBottom: "10px",
                      }}
                    >
                      Services
                    </h3>
                    {(servicesByCategory[selectedCategory] || []).map((service) => (
                      <div
                        key={service.id}
                        onClick={() => {
                          setSelectedServices((prev) => ({
                            ...prev,
                            [service.id]: (prev[service.id] || 0) + 1,
                          }))
                        }}
                        style={{
                          padding: "15px",
                          border: selectedServices[service.id] ? "2px solid #db2777" : "2px solid #fbcfe8",
                          borderRadius: "8px",
                          background: selectedServices[service.id] ? "#fce7f3" : "white",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: "600", color: "#1f2937" }}>{service.name}</div>
                          <div style={{ fontSize: "14px", color: "#6b7280" }}>₱{service.price}</div>
                        </div>
                        {selectedServices[service.id] && (
                          <div
                            style={{
                              background: "#db2777",
                              color: "white",
                              width: "30px",
                              height: "30px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "600",
                            }}
                          >
                            {selectedServices[service.id]}
                          </div>
                        )}
                      </div>
                    ))}

                    {categoryAddons[selectedCategory] && categoryAddons[selectedCategory].length > 0 && (
                      <>
                        <h3
                          style={{
                            fontSize: "16px",
                            fontWeight: "600",
                            color: "#1f2937",
                            marginTop: "20px",
                            marginBottom: "10px",
                          }}
                        >
                          Add-ons (Optional)
                        </h3>
                        {categoryAddons[selectedCategory].map((addon) => (
                          <div
                            key={addon.id}
                            onClick={() => {
                              setSelectedAddons((prev) => ({
                                ...prev,
                                [addon.id]: (prev[addon.id] || 0) + 1,
                              }))
                            }}
                            style={{
                              padding: "15px",
                              border: selectedAddons[addon.id] ? "2px solid #10b981" : "2px solid #d1fae5",
                              borderRadius: "8px",
                              background: selectedAddons[addon.id] ? "#d1fae5" : "white",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: "600", color: "#1f2937" }}>✨ {addon.name}</div>
                              <div style={{ fontSize: "14px", color: "#6b7280" }}>
                                ₱{addon.price} {addon.is_per_unit ? "per unit" : ""}
                              </div>
                            </div>
                            {selectedAddons[addon.id] && (
                              <div
                                style={{
                                  background: "#10b981",
                                  color: "white",
                                  width: "30px",
                                  height: "30px",
                                  borderRadius: "50%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: "600",
                                }}
                              >
                                {selectedAddons[addon.id]}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Date & Time Selection */}
              {wizardStep === 3 && (
                <div className={styles.detailsSection}>
                  <div style={{ width: "100%", maxWidth: "600px" }}>
                    <div
                      style={{
                        background: "linear-gradient(135deg, #db2777 0%, #be185d 100%)",
                        padding: "20px",
                        borderRadius: "12px",
                        marginBottom: "30px",
                        textAlign: "center",
                        boxShadow: "0 4px 12px rgba(219, 39, 119, 0.3)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "14px",
                          color: "rgba(255, 255, 255, 0.8)",
                          marginBottom: "8px",
                          fontWeight: "500",
                        }}
                      >
                        Current Date & Time
                      </div>
                      <div
                        style={{
                          fontSize: "36px",
                          fontWeight: "700",
                          color: "white",
                          letterSpacing: "2px",
                          fontFamily: "monospace",
                        }}
                      >
                        {currentTime.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })}
                      </div>
                      <div
                        style={{
                          fontSize: "16px",
                          color: "rgba(255, 255, 255, 0.9)",
                          marginTop: "8px",
                          fontWeight: "500",
                        }}
                      >
                        {currentTime.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </div>

                    <label
                      style={{
                        display: "block",
                        marginBottom: "10px",
                        fontWeight: "600",
                        color: "#1f2937",
                      }}
                    >
                      Select Appointment Date:
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "2px solid #fbcfe8",
                        borderRadius: "8px",
                        marginBottom: "25px",
                        fontSize: "15px",
                        fontWeight: "500",
                        color: "#1f2937",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#db2777")}
                      onBlur={(e) => (e.target.style.borderColor = "#fbcfe8")}
                    />

                    <label
                      style={{
                        display: "block",
                        marginBottom: "10px",
                        fontWeight: "600",
                        color: "#1f2937",
                      }}
                    >
                      Select Appointment Time (10:00 AM - 7:00 PM):
                    </label>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "8px",
                        maxHeight: "400px",
                        overflowY: "auto",
                        padding: "10px",
                        background: "#f9fafb",
                        borderRadius: "8px",
                        border: "1px solid #fbcfe8",
                      }}
                    >
                      {timeSlots.map((time) => {
                        const isBooked = isTimeSlotBooked(time)
                        const isSelected = selectedTime === time

                        return (
                          <button
                            key={time}
                            onClick={() => !isBooked && setSelectedTime(time)}
                            disabled={isBooked}
                            style={{
                              padding: "12px 8px",
                              border: isSelected
                                ? "2px solid #db2777"
                                : isBooked
                                  ? "2px solid #fecaca"
                                  : "2px solid #fbcfe8",
                              borderRadius: "8px",
                              background: isSelected ? "#db2777" : isBooked ? "#fee2e2" : "white",
                              color: isSelected ? "white" : isBooked ? "#991b1b" : "#1f2937",
                              cursor: isBooked ? "not-allowed" : "pointer",
                              fontSize: "13px",
                              fontWeight: isSelected ? "700" : "500",
                              opacity: isBooked ? 0.6 : 1,
                            }}
                          >
                            {formatTime(time)}
                            {isBooked && <div style={{ fontSize: "10px", marginTop: "4px" }}>Booked</div>}
                          </button>
                        )
                      })}
                    </div>

                    <div
                      style={{
                        marginTop: "20px",
                        padding: "15px",
                        background: "#fce7f3",
                        borderRadius: "8px",
                        border: "1px solid #fbcfe8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                      }}
                    >
                      <span style={{ fontSize: "20px" }}>📅</span>
                      <span style={{ fontWeight: "600", color: "#db2777" }}>
                        {new Date(selectedDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span style={{ color: "#9ca3af" }}>•</span>
                      <span style={{ fontSize: "20px" }}>🕐</span>
                      <span style={{ fontWeight: "600", color: "#db2777" }}>{formatTime(selectedTime)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Payment Method Selection */}
              {wizardStep === 4 && (
                <div className={styles.detailsSection}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      width: "100%",
                      maxWidth: "600px",
                    }}
                  >
                    {[{ id: "cash", name: "Cash", icon: "💵" }].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPayment(method.id)}
                        style={{
                          padding: "15px",
                          border: selectedPayment === method.id ? "2px solid #db2777" : "2px solid #fbcfe8",
                          borderRadius: "8px",
                          background: selectedPayment === method.id ? "#fce7f3" : "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                      >
                        <span>{method.icon}</span>
                        {method.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: Client Information */}
              {wizardStep === 5 && (
                <div className={styles.detailsSection}>
                  <div style={{ width: "100%", maxWidth: "600px" }}>
                    <div
                      style={{
                        marginBottom: "25px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "12px",
                        padding: "16px",
                        borderWidth: "1px",
                        borderColor: "#e5e7eb",
                        borderStyle: "solid",
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                      >
                        Select Existing Client (Optional):
                      </label>
                      <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "12px" }}>
                        Click on a client below to auto-fill their information
                      </p>

                      {loadingClients ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "#6b7280",
                          }}
                        >
                          Loading clients...
                        </div>
                      ) : clients.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "#6b7280",
                          }}
                        >
                          No clients found
                        </div>
                      ) : (
                        <div
                          style={{
                            maxHeight: "300px",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {clients.map((client) => (
                            <button
                              key={client.id}
                              onClick={() => handleSelectClient(client)}
                              style={{
                                padding: "12px",
                                border: selectedClientId === client.id ? "2px solid #db2777" : "2px solid #e5e7eb",
                                borderRadius: "8px",
                                background: selectedClientId === client.id ? "#fce7f3" : "#fff",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.3s ease",
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                              }}
                            >
                              <div
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "50%",
                                  backgroundColor: selectedClientId === client.id ? "#db2777" : "#e5e7eb",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <span
                                  style={{
                                    color: selectedClientId === client.id ? "#fff" : "#6b7280",
                                    fontWeight: "700",
                                  }}
                                >
                                  {client.name?.charAt(0).toUpperCase() || "U"}
                                </span>
                              </div>
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontWeight: "600",
                                    color: "#1f2937",
                                    fontSize: "14px",
                                  }}
                                >
                                  {client.name || "N/A"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#6b7280",
                                  }}
                                >
                                  {client.email || "N/A"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#6b7280",
                                  }}
                                >
                                  {client.contact_number || "N/A"}
                                </div>
                              </div>
                              {selectedClientId === client.id && (
                                <span
                                  style={{
                                    fontSize: "18px",
                                    color: "#db2777",
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", marginBottom: "20px" }}>
                      <div
                        style={{
                          flex: 1,
                          height: "1px",
                          backgroundColor: "#e5e7eb",
                        }}
                      ></div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#9ca3af",
                          fontWeight: "600",
                          marginHorizontal: "12px",
                        }}
                      >
                        OR
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: "1px",
                          backgroundColor: "#e5e7eb",
                        }}
                      ></div>
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                      >
                        Client Name:
                      </label>
                      <input
                        type="text"
                        value={bookingClientName}
                        onChange={(e) => setBookingClientName(e.target.value)}
                        placeholder="Enter client name"
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "2px solid #fbcfe8",
                          borderRadius: "8px",
                          fontSize: "15px",
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                      >
                        Phone Number:
                      </label>
                      <input
                        type="tel"
                        value={bookingClientPhone}
                        onChange={(e) => setBookingClientPhone(e.target.value)}
                        placeholder="Enter phone number"
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "2px solid #fbcfe8",
                          borderRadius: "8px",
                          fontSize: "15px",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: "600",
                          color: "#1f2937",
                        }}
                      >
                        Email:
                      </label>
                      <input
                        type="email"
                        value={bookingClientEmail}
                        onChange={(e) => setBookingClientEmail(e.target.value)}
                        placeholder="Enter email"
                        style={{
                          width: "100%",
                          padding: "12px",
                          border: "2px solid #fbcfe8",
                          borderRadius: "8px",
                          fontSize: "15px",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.actionsSection}>
                {wizardStep > 1 && (
                  <button
                    className={`${styles.actionBtn} ${styles.cancelBtn}`}
                    onClick={() => setWizardStep(wizardStep - 1)}
                  >
                    ← Back
                  </button>
                )}
                {wizardStep < 5 ? (
                  <button
                    className={`${styles.actionBtn} ${styles.approveBtn}`}
                    onClick={() => setWizardStep(wizardStep + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    className={`${styles.actionBtn} ${styles.approveBtn}`}
                    onClick={handleCompleteBooking}
                    disabled={!bookingClientName || !bookingClientPhone || !bookingClientEmail}
                  >
                    ✅ Create Booking
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModalVisible && successBookingData && (
        <div className={styles.detailsPanel}>
          <div>
            <div className={styles.detailsHeader}>
              <h2 className={styles.detailsTitle}>✨ Booking Created Successfully!</h2>
            </div>

            <div className={styles.detailsContent}>
              <div className={styles.detailsSection}>
                <div style={{ textAlign: "center", width: "100%", maxWidth: "600px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "20px" }}>🎉</div>
                  <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#1f2937", marginBottom: "10px" }}>
                    Booking Confirmed!
                  </h3>
                  <p style={{ color: "#6b7280", marginBottom: "20px" }}>
                    Your appointment has been successfully created.
                  </p>

                  <div
                    style={{
                      background: "#fce7f3",
                      padding: "20px",
                      borderRadius: "8px",
                      textAlign: "left",
                      marginBottom: "20px",
                    }}
                  >
                    <div style={{ marginBottom: "10px" }}>
                      <span style={{ fontWeight: "600", color: "#1f2937" }}>Client: </span>
                      <span style={{ color: "#6b7280" }}>{successBookingData.name}</span>
                    </div>
                    <div style={{ marginBottom: "10px" }}>
                      <span style={{ fontWeight: "600", color: "#1f2937" }}>Date: </span>
                      <span style={{ color: "#6b7280" }}>{successBookingData.date}</span>
                    </div>
                    <div style={{ marginBottom: "10px" }}>
                      <span style={{ fontWeight: "600", color: "#1f2937" }}>Time: </span>
                      <span style={{ color: "#6b7280" }}>{successBookingData.time}</span>
                    </div>
                    <div style={{ marginBottom: "10px" }}>
                      <span style={{ fontWeight: "600", color: "#1f2937" }}>Services: </span>
                      <span style={{ color: "#6b7280" }}>{successBookingData.services}</span>
                    </div>
                    <div style={{ marginBottom: "10px" }}>
                      <span style={{ fontWeight: "600", color: "#1f2937" }}>Total: </span>
                      <span style={{ color: "#db2777", fontWeight: "600" }}>
                        ₱{successBookingData.total.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontWeight: "600", color: "#1f2937" }}>Payment: </span>
                      <span style={{ color: "#6b7280" }}>{successBookingData.paymentMethod}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.actionsSection}>
                <button
                  className={`${styles.actionBtn} ${styles.approveBtn}`}
                  onClick={() => {
                    setSuccessModalVisible(false)
                    setSuccessBookingData(null)
                  }}
                >
                  ✅ Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Bookings
