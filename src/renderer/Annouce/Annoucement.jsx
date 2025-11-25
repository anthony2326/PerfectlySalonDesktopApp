"use client"

import { useState, useEffect } from "react"
import Sidebar from "../components/Sidebar/Sidebar"
import styles from "../Annouce/Annoucement.module.css"
import supabase from "../../../utils/supabase"

const Announcements = ({ logoSrc, logoAlt = "Logo", onNavigate, onLogout }) => {
  const [announcements, setAnnouncements] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    priority: "notices",
    validUntil: "",
    highlight: "",
  })

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const loadAnnouncements = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setAnnouncements(data || [])
    } catch (err) {
      console.error('Error loading announcements:', err)
      setError('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (e) => {
    e.preventDefault()

    try {
      setLoading(true)
      setError(null)

      const newAnnouncement = {
        title: formData.title,
        message: formData.message,
        priority: formData.priority,
        author: "Michael Chen",
        valid_until: formData.validUntil || null,
        highlight: formData.highlight || null,
      }

      const { data, error } = await supabase
        .from('announcements')
        .insert([newAnnouncement])
        .select()

      if (error) throw error

      setAnnouncements([data[0], ...announcements])
      setFormData({ title: "", message: "", priority: "notices", validUntil: "", highlight: "" })
      setShowForm(false)
    } catch (err) {
      console.error('Error publishing announcement:', err)
      setError('Failed to publish announcement')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)

      if (error) throw error

      setAnnouncements(announcements.filter((a) => a.id !== id))
    } catch (err) {
      console.error('Error deleting announcement:', err)
      setError('Failed to delete announcement')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const filteredAnnouncements =
    activeFilter === "all" ? announcements : announcements.filter((a) => a.priority === activeFilter)

  return (
    <div className={styles.container}>
      <Sidebar
        logoSrc={logoSrc}
        logoAlt={logoAlt}
        currentPage="Announcements"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Announcements</h1>
            <p className={styles.subtitle}>Publish and manage salon announcements</p>
          </div>
          <button className={styles.publishButton} onClick={() => setShowForm(!showForm)} disabled={loading}>
            <span className={styles.buttonIcon}>
              <i className={showForm ? "fas fa-times" : "fas fa-plus"}></i>
            </span>
            {showForm ? "Cancel" : "New Announcement"}
          </button>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}

        {showForm && (
          <div className={styles.formCard}>
            <h3 className={styles.formTitle}>Create New Announcement</h3>
            <form onSubmit={handlePublish}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Title</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Enter announcement title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Message</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Enter announcement message"
                  rows="4"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Category</label>
                <select
                  className={styles.select}
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  disabled={loading}
                >
                  <option value="promotions">Promotions</option>
                  <option value="events">Events</option>
                  <option value="notices">Notices</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Valid Until (Optional)</label>
                <input
                  type="date"
                  className={styles.input}
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Highlight Text (Optional)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g., 20% OFF"
                  value={formData.highlight}
                  onChange={(e) => setFormData({ ...formData, highlight: e.target.value })}
                  disabled={loading}
                />
              </div>

              <button type="submit" className={styles.submitButton} disabled={loading}>
                <span className={styles.buttonIcon}>
                  <i className={loading ? "fas fa-spinner fa-spin" : "fas fa-paper-plane"}></i>
                </span>
                {loading ? "Publishing..." : "Publish Announcement"}
              </button>
            </form>
          </div>
        )}

        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${activeFilter === "all" ? styles.filterTabActive : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            All
          </button>
          <button
            className={`${styles.filterTab} ${activeFilter === "promotions" ? styles.filterTabActive : ""}`}
            onClick={() => setActiveFilter("promotions")}
          >
            Promotions
          </button>
          <button
            className={`${styles.filterTab} ${activeFilter === "events" ? styles.filterTabActive : ""}`}
            onClick={() => setActiveFilter("events")}
          >
            Events
          </button>
          <button
            className={`${styles.filterTab} ${activeFilter === "notices" ? styles.filterTabActive : ""}`}
            onClick={() => setActiveFilter("notices")}
          >
            Notices
          </button>
        </div>

        <div className={styles.announcementsList}>
          {loading && announcements.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <i className="fas fa-spinner fa-spin"></i>
              </span>
              <h3 className={styles.emptyTitle}>Loading announcements...</h3>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📢</span>
              <h3 className={styles.emptyTitle}>
                {activeFilter === "all" ? "No announcements yet" : `No ${activeFilter} found`}
              </h3>
              <p className={styles.emptyText}>
                {activeFilter === "all"
                  ? "Create your first announcement to keep your team informed"
                  : `Try selecting a different category`}
              </p>
            </div>
          ) : (
            filteredAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className={`${styles.announcementCard} ${styles[`priority${announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}`]}`}
              >
                <div className={styles.announcementHeader}>
                  <span
                    className={`${styles.categoryBadge} ${styles[`badge${announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}`]}`}
                  >
                    {announcement.priority.toUpperCase()}
                  </span>
                  <span className={styles.postedDate}>
                    <span className={styles.postedLabel}>POSTED</span>
                    <span className={styles.dateValue}>{formatDate(announcement.created_at)}</span>
                  </span>
                </div>

                <h3 className={styles.announcementTitle}>{announcement.title}</h3>
                <p className={styles.announcementMessage}>{announcement.message}</p>

                {announcement.valid_until && (
                  <div className={styles.validUntil}>
                    <i className="far fa-clock"></i> Valid until{" "}
                    {new Date(announcement.valid_until).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                )}

                {announcement.highlight && (
                  <div className={styles.highlightBox}>
                    <i className="fas fa-tag"></i> {announcement.highlight}
                  </div>
                )}

                <button
                  className={styles.deleteButton}
                  onClick={() => handleDelete(announcement.id)}
                  title="Delete announcement"
                  disabled={loading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Announcements