import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import styles from '../Clients/Clients.module.css';
import supabase from '../../../../utils/supabase';

const Clients = ({ logoSrc, logoAlt, onNavigate, onLogout }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookingCounts, setBookingCounts] = useState({});
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    name: '',
    contact_number: '',
    age: '',
  });

  useEffect(() => {
    loadClients();
    loadBookingCounts();

    const clientsChannel = supabase
      .channel('clients-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('[CLIENTS] Real-time event:', payload);
          
          if (payload.eventType === 'INSERT') {
            setClients(current => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setClients(current =>
              current.map(client =>
                client.id === payload.new.id ? payload.new : client
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setClients(current =>
              current.filter(client => client.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    const appointmentsChannel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
        },
        () => {
          console.log('[CLIENTS] Appointments updated, refreshing counts...');
          loadBookingCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[CLIENTS] Error loading clients:', error);
      } else {
        setClients(data || []);
      }
    } catch (err) {
      console.error('[CLIENTS] Exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookingCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('client_email, status');

      if (error) {
        console.error('[CLIENTS] Error loading booking counts:', error);
        return;
      }

      // Count completed bookings per client email
      const counts = {};
      data.forEach(appointment => {
        const email = appointment.client_email;
        if (!counts[email]) {
          counts[email] = 0;
        }
        if (appointment.status === 'completed') {
          counts[email]++;
        }
      });

      setBookingCounts(counts);
    } catch (err) {
      console.error('[CLIENTS] Exception loading booking counts:', err);
    }
  };

  const handleBlockUser = async (userId, currentBlockStatus, clientName) => {
    const action = currentBlockStatus ? 'unblock' : 'block';
    const message = currentBlockStatus
      ? `Are you sure you want to unblock ${clientName}? They will be able to login again.`
      : `Are you sure you want to block ${clientName}? They will not be able to login to the app.`;

    if (!window.confirm(message)) {
      return;
    }

    try {
      const newBlockStatus = !currentBlockStatus;

      const { data, error } = await supabase
        .from('users')
        .update({ is_blocked: newBlockStatus })
        .eq('id', userId);

      if (error) {
        console.error(`[CLIENTS] Error ${action}ing user:`, error);
        alert(`Failed to ${action} user. Please try again.`);
      } else {
        console.log(`[CLIENTS] User ${action}ed successfully`);
        alert(
          `${clientName} has been ${action}ed successfully${
            newBlockStatus ? ' and can no longer login' : ''
          }.`
        );
        loadClients();
      }
    } catch (err) {
      console.error('[CLIENTS] Exception:', err);
      alert('An error occurred. Please try again.');
    }
  };

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;

    if (!formData.email || !emailRegex.test(formData.email)) {
      alert('Please enter a valid email address.');
      return false;
    }

    if (!formData.username || !usernameRegex.test(formData.username)) {
      alert('Username must be 3-50 characters and contain only letters, numbers, and underscores.');
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return false;
    }

    if (!formData.name || formData.name.trim().length < 2) {
      alert('Please enter a valid name (at least 2 characters).');
      return false;
    }

    if (!formData.contact_number || formData.contact_number.length < 10) {
      alert('Please enter a valid contact number (at least 10 digits).');
      return false;
    }

    const age = parseInt(formData.age);
    if (!formData.age || isNaN(age) || age < 13 || age > 120) {
      alert('Age must be between 13 and 120.');
      return false;
    }

    return true;
  };

  const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const handleAddClient = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      // Hash the password using Web Crypto API (SHA-256)
      const passwordHash = await hashPassword(formData.password.trim());

      const { data, error } = await supabase.from('users').insert([
        {
          email: formData.email.toLowerCase().trim(),
          username: formData.username.trim(),
          password_hash: passwordHash,
          name: formData.name.trim(),
          contact_number: formData.contact_number.trim(),
          age: parseInt(formData.age),
          is_verified: false,
          is_blocked: false,
        },
      ]);

      if (error) {
        console.error('[CLIENTS] Error adding client:', error);
        
        if (error.code === '23505') {
          if (error.message.includes('email')) {
            alert('This email address is already registered.');
          } else if (error.message.includes('username')) {
            alert('This username is already taken.');
          } else {
            alert('A user with these details already exists.');
          }
        } else {
          alert('Failed to add client. Please try again.');
        }
      } else {
        alert('Client account created successfully!');
        setAddModalVisible(false);
        resetForm();
        loadClients();
      }
    } catch (err) {
      console.error('[CLIENTS] Exception adding client:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
      name: '',
      contact_number: '',
      age: '',
    });
    setShowPassword(false);
  };

  const handleCloseModal = () => {
    setAddModalVisible(false);
    resetForm();
  };

  const getFilteredClients = () => {
    let filtered = clients;

    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredClients = getFilteredClients();
  const verifiedCount = clients.filter(c => c.is_verified).length;
  const pendingCount = clients.filter(c => !c.is_verified).length;

  return (
    <div className={styles.container}>
      <Sidebar 
        logoSrc={logoSrc}
        logoAlt={logoAlt}
        currentPage="Clients"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.pageTitle}>Clients Management</h1>
              <p className={styles.subtitle}>Manage client accounts and track their booking history</p>
            </div>
            <button className={styles.addButton} onClick={() => setAddModalVisible(true)}>
              <span className={styles.addIcon}>+</span>
              Add Client
            </button>
          </div>
          <div className={styles.statsCards}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ backgroundColor: '#e0f2fe' }}>
                <span style={{ color: '#0284c7' }}>👥</span>
              </div>
              <div>
                <p className={styles.statLabel}>Total Clients</p>
                <p className={styles.statValue}>{clients.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.controls}>
            <div className={styles.searchContainer}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search clients by name, email, or username..."
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>Loading clients...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <h3>No clients found</h3>
              <p>No clients match your current filters</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.clientsTable}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Username</th>
                    <th>Age</th>
                    <th>Joined</th>
                    <th>Completed Bookings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const completedBookings = bookingCounts[client.email] || 0;
                    
                    return (
                      <tr key={client.id}>
                        <td>
                          <div className={styles.clientInfo}>
                            <div className={styles.clientAvatar}>
                              {client.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className={styles.clientName}>
                                {client.name || 'N/A'}
                                {client.is_verified && (
                                  <span className={styles.verifiedBadge} title="Verified">✓</span>
                                )}
                                {client.is_blocked && (
                                  <span className={styles.blockedBadge} title="Blocked">🔒</span>
                                )}
                              </p>
                              <p className={styles.clientEmail}>{client.email || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td>{client.contact_number || 'N/A'}</td>
                        <td>{client.username || 'N/A'}</td>
                        <td>{client.age || 'N/A'}</td>
                        <td>
                          {client.created_at
                            ? new Date(client.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={styles.bookingsNumber}>{completedBookings}</span>
                        </td>
                        <td>
                          <button
                            className={`${styles.actionButton} ${
                              client.is_blocked ? styles.unblockButton : styles.blockButton
                            }`}
                            onClick={() =>
                              handleBlockUser(client.id, client.is_blocked, client.name || 'User')
                            }
                          >
                            {client.is_blocked ? 'Unblock' : 'Block'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Client Modal */}
      {addModalVisible && (
        <div className={styles.modalOverlay} onClick={handleCloseModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add New Client</h2>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email *</label>
                <input
                  type="email"
                  className={styles.formInput}
                  placeholder="example@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Username *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="username123"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Password *</label>
                <div className={styles.passwordContainer}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.passwordInput}
                    placeholder="Min. 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className={styles.eyeButton}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Name *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Contact Number *</label>
                <input
                  type="tel"
                  className={styles.formInput}
                  placeholder="+63 912 345 6789"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Age *</label>
                <input
                  type="number"
                  className={styles.formInput}
                  placeholder="13-120"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                />
              </div>

              <p className={styles.formNote}>
                * All fields are required. Age must be between 13 and 120.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={handleCloseModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.saveButton}
                onClick={handleAddClient}
                disabled={saving}
              >
                {saving ? 'Adding...' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;