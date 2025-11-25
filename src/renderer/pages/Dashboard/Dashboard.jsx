import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import styles from './Dashboard.module.css';
import supabase from '../../../../utils/supabase';
import { DollarSign, Calendar, AlertTriangle, Clock, Users, Package } from 'lucide-react';

const Dashboard = ({ logoSrc, logoAlt = "Logo", onNavigate, onLogout, userName, userRole }) => {
  const [currentDate] = useState(new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }));

  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState({ total: 0, remaining: 0 });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();

    // Subscribe to real-time updates
    const appointmentsChannel = supabase
      .channel('dashboard-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        console.log('[DASHBOARD] Appointments changed, reloading...');
        loadDashboardData();
      })
      .subscribe();

    const inventoryChannel = supabase
      .channel('dashboard-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        console.log('[DASHBOARD] Inventory changed, reloading...');
        loadLowStockItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTodayRevenue(),
        loadTodayAppointments(),
        loadLowStockItems(),
        loadTodaySchedule()
      ]);
    } catch (error) {
      console.error('[DASHBOARD] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayRevenue = async () => {
    try {
      // Get today's date in YYYY-MM-DD format in local timezone
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayDate = `${year}-${month}-${day}`;
      
      const { data, error } = await supabase
        .from('appointments')
        .select('total_amount')
        .eq('appointment_date', todayDate)
        .eq('status', 'completed');

      if (error) {
        console.error('[DASHBOARD] Error loading revenue:', error);
        setTodayRevenue(0);
        return;
      }

      const total = (data || []).reduce((sum, apt) => sum + (parseFloat(apt.total_amount) || 0), 0);
      setTodayRevenue(total);
      console.log('[DASHBOARD] Today\'s revenue for', todayDate, ':', total);
    } catch (error) {
      console.error('[DASHBOARD] Error loading revenue:', error);
      setTodayRevenue(0);
    }
  };

  const loadTodayAppointments = async () => {
    try {
      // Get today's date in YYYY-MM-DD format in local timezone
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayDate = `${year}-${month}-${day}`;
      
      const { data, error } = await supabase
        .from('appointments')
        .select('status')
        .eq('appointment_date', todayDate);

      if (error) {
        console.error('[DASHBOARD] Error loading appointments:', error);
        setTodayAppointments({ total: 0, remaining: 0 });
        return;
      }

      const allAppointments = data || [];
      const total = allAppointments.length;
      const remaining = allAppointments.filter(apt => 
        apt.status === 'pending' || apt.status === 'confirmed'
      ).length;

      setTodayAppointments({ total, remaining });
      console.log('[DASHBOARD] Today\'s appointments for', todayDate, ':', { total, remaining });
    } catch (error) {
      console.error('[DASHBOARD] Error loading appointments:', error);
      setTodayAppointments({ total: 0, remaining: 0 });
    }
  };

  const loadLowStockItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('quantity', { ascending: true });

      if (error) {
        console.error('[DASHBOARD] Error loading inventory:', error);
        setLowStockItems([]);
        return;
      }

      // Filter items where quantity is at or below min_stock
      const lowStock = (data || []).filter(item => 
        item.quantity <= (item.min_stock || 10)
      );
      
      setLowStockItems(lowStock);
      console.log('[DASHBOARD] Low stock items:', lowStock.length);
    } catch (error) {
      console.error('[DASHBOARD] Error loading inventory:', error);
      setLowStockItems([]);
    }
  };

  const loadTodaySchedule = async () => {
    try {
      // Get today's date in YYYY-MM-DD format in local timezone
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayDate = `${year}-${month}-${day}`;
      
      console.log('[DASHBOARD] Loading schedule for date:', todayDate);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', todayDate)
        .in('status', ['pending', 'confirmed', 'completed']) // Exclude cancelled
        .order('appointment_time', { ascending: true })
        .limit(5);

      if (error) {
        console.error('[DASHBOARD] Error loading schedule:', error);
        setTodaySchedule([]);
        return;
      }

      console.log('[DASHBOARD] Raw appointments data:', data);

      const formattedSchedule = (data || []).map(apt => {
        // Handle services - can be array of objects or strings
        let serviceText = 'No service';
        if (Array.isArray(apt.services)) {
          serviceText = apt.services
            .map(s => (typeof s === 'object' ? s.name : s))
            .filter(Boolean)
            .join(', ') || 'No service';
        } else if (typeof apt.services === 'string') {
          serviceText = apt.services;
        }

        return {
          time: apt.appointment_time || 'TBD',
          client: apt.client_name || 'Unknown',
          service: serviceText,
          stylist: apt.stylist || 'Not assigned',
          status: apt.status || 'pending'
        };
      });

      setTodaySchedule(formattedSchedule);
      console.log('[DASHBOARD] Today\'s schedule loaded:', formattedSchedule.length, 'appointments for', todayDate);
    } catch (error) {
      console.error('[DASHBOARD] Error loading schedule:', error);
      setTodaySchedule([]);
    }
  };

  const statsData = [
    {
      title: "Today's Revenue",
      value: `₱${todayRevenue.toFixed(2)}`,
      subtitle: `From ${todayAppointments.total} appointments`,
      icon: <DollarSign size={24} />,
      color: "green"
    },
    {
      title: "Today's Appointments",
      value: todayAppointments.total.toString(),
      subtitle: `${todayAppointments.remaining} pending/confirmed`,
      icon: <Calendar size={24} />,
      color: "blue"
    },
    {
      title: "Low Stock Items",
      value: lowStockItems.length.toString(),
      subtitle: lowStockItems.length > 0 ? "Items need restocking" : "All items in stock",
      icon: <AlertTriangle size={24} />,
      color: "yellow"
    }
  ];

  const alerts = [
    ...lowStockItems.slice(0, 3).map(item => ({
      type: "urgent",
      title: `Low Stock: ${item.name}`,
      subtitle: `Only ${item.quantity} ${item.unit} remaining (min: ${item.min_stock})`,
      status: "Urgent"
    })),
    ...(todaySchedule.length > 0 ? [{
      type: "success",
      title: "Today's Schedule Active",
      subtitle: `${todaySchedule.length} appointments scheduled`,
      status: "Active"
    }] : [])
  ];

  // Add a placeholder if no alerts
  if (alerts.length === 0) {
    alerts.push({
      type: "success",
      title: "All Systems Normal",
      subtitle: "No urgent alerts at this time",
      status: "Good"
    });
  }

  const getStatusDisplay = (status) => {
    switch(status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Sidebar 
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          currentPage="Dashboard"
          onNavigate={onNavigate}
          onLogout={onLogout}
          userName={userName}
          userRole={userRole}
        />
        <div className={styles.mainContent}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <div className={styles.spinner}></div>
              <p style={{ color: '#6b7280', marginTop: '20px' }}>Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Sidebar 
        logoSrc={logoSrc}
        logoAlt={logoAlt}
        currentPage="Dashboard"
        onNavigate={onNavigate}
        onLogout={onLogout}
        userName={userName}
        userRole={userRole}
      />

      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div className={styles.currentDate}>{currentDate}</div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.welcomeMessage}>
            Welcome back - Your salon is running smoothly
          </p>
        </div>

        <div className={styles.statsGrid}>
          {statsData.map((stat, index) => (
            <div 
              key={index} 
              className={styles.statsCard}
              style={{
                background: stat.color === 'yellow' ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 'white',
                borderColor: stat.color === 'yellow' ? '#fbbf24' : '#fbcfe8'
              }}
            >
              <div className={styles.statsHeader}>
                <span className={styles.statsTitle}>{stat.title}</span>
                <span 
                  className={styles.statsIcon}
                  style={{ color: stat.color === 'yellow' ? '#d97706' : 'inherit' }}
                >
                  {stat.icon}
                </span>
              </div>
              <div className={styles.statsValue}>{stat.value}</div>
              <div 
                className={styles.statsSubtitle}
                style={{ 
                  color: stat.color === 'green' ? '#059669' : 
                         stat.color === 'yellow' ? '#92400e' : 
                         '#6b7280' 
                }}
              >
                {stat.subtitle}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actionsAlertsGrid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Quick Actions</h3>
            <div className={styles.actionsList}>
              <button className={styles.actionButton} onClick={() => onNavigate && onNavigate('scheduling')}>
                <span className={styles.actionIcon}><Calendar size={20} /></span>
                View All Appointments
              </button>
              <button className={styles.actionButton} onClick={() => onNavigate && onNavigate('inventory')}>
                <span className={styles.actionIcon}><Package size={20} /></span>
                Manage Inventory
              </button>
              <button className={styles.actionButton} onClick={() => onNavigate && onNavigate('clients')}>
                <span className={styles.actionIcon}><Users size={20} /></span>
                View All Clients
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.alertsHeader}>
              <span className={styles.alertsIcon}><AlertTriangle size={20} /></span>
              <h3 className={styles.cardTitle}>Alerts & Notifications</h3>
            </div>
            <div className={styles.alertsList}>
              {alerts.map((alert, index) => (
                <div key={index} className={`${styles.alertItem} ${styles[`alert${alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}`]}`}>
                  <div className={styles.alertContent}>
                    <div className={styles.alertTitle}>{alert.title}</div>
                    <div className={styles.alertSubtitle}>{alert.subtitle}</div>
                  </div>
                  <span className={`${styles.alertStatus} ${styles[`alertStatus${alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}`]}`}>
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.scheduleSection}>
          <h3 className={styles.cardTitle}>Today's Schedule</h3>
          {todaySchedule.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <Calendar size={48} style={{ display: 'block', margin: '0 auto 16px' }} />
              <p style={{ margin: 0 }}>No appointments scheduled for today</p>
            </div>
          ) : (
            <div className={styles.scheduleList}>
              {todaySchedule.map((appointment, index) => (
                <div key={index} className={styles.appointmentItem}>
                  <div className={styles.appointmentTime}>
                    <span className={styles.timeIcon}><Clock size={16} /></span>
                    {appointment.time}
                  </div>
                  <div className={styles.appointmentDetails}>
                    <div className={styles.appointmentClient}>{appointment.client}</div>
                    <div className={styles.appointmentService}>
                      {appointment.service} • {appointment.stylist}
                    </div>
                  </div>
                  <span className={`${styles.appointmentStatus} ${styles[`status${appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', '')}`]}`}>
                    {getStatusDisplay(appointment.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;