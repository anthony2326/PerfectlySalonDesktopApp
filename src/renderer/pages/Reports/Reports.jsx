// Reports.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import styles from './Reports.module.css';
import supabase from '../../../../utils/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const Reports = ({ logoSrc, logoAlt, onNavigate, onLogout }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [serviceStats, setServiceStats] = useState([]);
  const [chartType, setChartType] = useState('bar'); // 'bar' or 'pie'

  // Colors for charts
  const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

  // Fetch ALL appointments from Supabase
  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        console.log('Fetching ALL appointments...');

        // Fetch ALL completed appointments - NO FILTERS
        const { data, error, count } = await supabase
          .from('appointments')
          .select('*', { count: 'exact' })
          .eq('status', 'completed')
          .order('appointment_date', { ascending: false });

        console.log('Query result:', { data, error, count });
        console.log('Total rows fetched:', data?.length || 0);

        if (error) {
          console.error('Supabase error:', error);
          alert(`Error fetching data: ${error.message}`);
          setAppointments([]);
        } else {
          console.log('Successfully fetched appointments:', data);
          setAppointments(data || []);
          calculateServiceStats(data || []);
        }
      } catch (error) {
        console.error('Catch error:', error);
        alert(`Unexpected error: ${error.message}`);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();

    // Real-time subscription for updates
    const subscription = supabase
      .channel('appointments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Realtime change detected:', payload);
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const calculateServiceStats = (data) => {
    const serviceMap = {};
    
    data.forEach(appointment => {
      const services = Array.isArray(appointment.services) ? appointment.services : [];
      services.forEach(service => {
        if (serviceMap[service.name]) {
          serviceMap[service.name].count += 1;
          serviceMap[service.name].revenue += parseFloat(service.price || 0);
        } else {
          serviceMap[service.name] = {
            name: service.name,
            count: 1,
            revenue: parseFloat(service.price || 0)
          };
        }
      });
    });

    const stats = Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue);
    setServiceStats(stats);
  };

  const filterAppointments = () => {
    let filtered = [...appointments];
    const today = new Date();
    
    switch(dateFilter) {
      case 'today':
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate.toDateString() === today.toDateString();
        });
        break;
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate >= weekAgo;
        });
        break;
      case 'month':
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(apt => {
          const aptDate = new Date(apt.appointment_date);
          return aptDate >= monthAgo;
        });
        break;
      case 'custom':
        if (customDateRange.startDate && customDateRange.endDate) {
          filtered = filtered.filter(apt => {
            const aptDate = new Date(apt.appointment_date);
            const start = new Date(customDateRange.startDate);
            const end = new Date(customDateRange.endDate);
            return aptDate >= start && aptDate <= end;
          });
        }
        break;
      default:
        break;
    }
    
    return filtered;
  };

  const filteredData = filterAppointments();

  const getTotalRevenue = () => {
    return filteredData.reduce((sum, apt) => sum + parseFloat(apt.total_amount || 0), 0);
  };

  const getAverageTransaction = () => {
    if (filteredData.length === 0) return 0;
    return getTotalRevenue() / filteredData.length;
  };

  const getPaymentMethodBreakdown = () => {
    const breakdown = {};
    filteredData.forEach(apt => {
      if (breakdown[apt.payment_method]) {
        breakdown[apt.payment_method] += parseFloat(apt.total_amount || 0);
      } else {
        breakdown[apt.payment_method] = parseFloat(apt.total_amount || 0);
      }
    });
    return breakdown;
  };

  const getStylistBreakdown = () => {
    const breakdown = {};
    filteredData.forEach(apt => {
      if (breakdown[apt.stylist]) {
        breakdown[apt.stylist].revenue += parseFloat(apt.total_amount || 0);
        breakdown[apt.stylist].count += 1;
      } else {
        breakdown[apt.stylist] = {
          revenue: parseFloat(apt.total_amount || 0),
          count: 1
        };
      }
    });
    return breakdown;
  };

  // Prepare data for charts
  const getServiceChartData = () => {
    const serviceMap = {};
    
    filteredData.forEach(appointment => {
      const services = Array.isArray(appointment.services) ? appointment.services : [];
      services.forEach(service => {
        if (serviceMap[service.name]) {
          serviceMap[service.name] += 1;
        } else {
          serviceMap[service.name] = 1;
        }
      });
    });

    return Object.entries(serviceMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const exportToCSV = () => {
    if (filteredData.length === 0) {
      alert('No data to export');
      return;
    }

    const csvData = filteredData.map(apt => {
      const services = Array.isArray(apt.services) ? apt.services : [];
      return {
        'Order Number': apt.order_number,
        'Date': formatDate(apt.appointment_date),
        'Time': apt.appointment_time,
        'Client': apt.client_name,
        'Email': apt.client_email,
        'Phone': apt.client_phone,
        'Stylist': apt.stylist,
        'Services': services.map(s => s.name).join('; '),
        'Payment Method': apt.payment_method,
        'Amount': apt.total_amount
      };
    });

    const headers = Object.keys(csvData[0]);
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h]}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Custom label for pie chart
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        style={{ fontSize: '14px', fontWeight: 'bold' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Sidebar 
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          currentPage="Reports"
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
        <div className={styles.mainContent}>
          <div className={styles.loading}>Loading reports...</div>
        </div>
      </div>
    );
  }

  const paymentBreakdown = getPaymentMethodBreakdown();
  const stylistBreakdown = getStylistBreakdown();
  const serviceChartData = getServiceChartData();

  return (
    <div className={styles.container}>
      <Sidebar 
        logoSrc={logoSrc}
        logoAlt={logoAlt}
        currentPage="Reports"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Sales Reports</h1>
            <p className={styles.subtitle}>Analytics and revenue insights • Showing {appointments.length} total appointments</p>
          </div>
          <button className={styles.exportBtn} onClick={exportToCSV}>
            📥 Export CSV
          </button>
        </div>

        {/* Date Filter */}
        <div className={styles.filterSection}>
          <div className={styles.filterButtons}>
            <button 
              className={dateFilter === 'all' ? styles.filterActive : styles.filterBtn}
              onClick={() => setDateFilter('all')}
            >
              All Time
            </button>
            <button 
              className={dateFilter === 'today' ? styles.filterActive : styles.filterBtn}
              onClick={() => setDateFilter('today')}
            >
              Today
            </button>
            <button 
              className={dateFilter === 'week' ? styles.filterActive : styles.filterBtn}
              onClick={() => setDateFilter('week')}
            >
              Last 7 Days
            </button>
            <button 
              className={dateFilter === 'month' ? styles.filterActive : styles.filterBtn}
              onClick={() => setDateFilter('month')}
            >
              Last 30 Days
            </button>
            <button 
              className={dateFilter === 'custom' ? styles.filterActive : styles.filterBtn}
              onClick={() => setDateFilter('custom')}
            >
              Custom Range
            </button>
          </div>
          
          {dateFilter === 'custom' && (
            <div className={styles.customDateRange}>
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange({...customDateRange, startDate: e.target.value})}
                className={styles.dateInput}
              />
              <span>to</span>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange({...customDateRange, endDate: e.target.value})}
                className={styles.dateInput}
              />
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              💰
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Total Revenue</p>
              <p className={styles.statValue}>₱{getTotalRevenue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }}>
              📋
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Completed Appointments</p>
              <p className={styles.statValue}>{filteredData.length}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              📊
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Average Transaction</p>
              <p className={styles.statValue}>₱{getAverageTransaction().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Service Distribution Chart with Toggle */}
        <div className={styles.card}>
          <div className={styles.chartHeader}>
            <h3 className={styles.cardTitle}>📊 Service Distribution</h3>
            <div className={styles.chartToggle}>
              <button 
                className={chartType === 'bar' ? styles.toggleActive : styles.toggleBtn}
                onClick={() => setChartType('bar')}
              >
                📊 Bar Chart
              </button>
              <button 
                className={chartType === 'pie' ? styles.toggleActive : styles.toggleBtn}
                onClick={() => setChartType('pie')}
              >
                🥧 Pie Chart
              </button>
            </div>
          </div>
          {serviceChartData.length === 0 ? (
            <p className={styles.emptyMessage}>No service data available</p>
          ) : (
            <div className={styles.chartContainer}>
              {chartType === 'bar' ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={serviceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${value} bookings`,
                        'Appointments'
                      ]}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #fbcfe8',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="#ec4899" radius={[8, 8, 0, 0]}>
                      {serviceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={serviceChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={130}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {serviceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        `${value} bookings (${((value / filteredData.length) * 100).toFixed(1)}%)`,
                        props.payload.name
                      ]}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry) => `${value} (${entry.payload.value} bookings)`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* Two Column Layout */}
        <div className={styles.twoColumnGrid}>
          {/* Service Performance */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Service Performance</h3>
            {serviceStats.length === 0 ? (
              <p className={styles.emptyMessage}>No service data available</p>
            ) : (
              <div className={styles.serviceList}>
                {serviceStats.map((service, index) => (
                  <div key={index} className={styles.serviceItem}>
                    <div className={styles.serviceInfo}>
                      <span className={styles.serviceName}>{service.name}</span>
                      <span className={styles.serviceCount}>{service.count} bookings</span>
                    </div>
                    <div className={styles.serviceRevenue}>
                      ₱{service.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Payment Method Breakdown</h3>
            {Object.keys(paymentBreakdown).length === 0 ? (
              <p className={styles.emptyMessage}>No payment data available</p>
            ) : (
              <div className={styles.paymentList}>
                {Object.entries(paymentBreakdown).map(([method, amount], index) => (
                  <div key={index} className={styles.paymentItem}>
                    <div className={styles.paymentMethod}>
                      <span className={styles.paymentIcon}>
                        {method === 'Cash' ? '💵' : method === 'Card' ? '💳' : '📱'}
                      </span>
                      <span>{method}</span>
                    </div>
                    <div className={styles.paymentAmount}>
                      ₱{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stylist Performance */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Stylist Performance</h3>
          {Object.keys(stylistBreakdown).length === 0 ? (
            <p className={styles.emptyMessage}>No stylist data available</p>
          ) : (
            <div className={styles.stylistGrid}>
              {Object.entries(stylistBreakdown).map(([stylist, data], index) => (
                <div key={index} className={styles.stylistCard}>
                  <div className={styles.stylistAvatar}>
                    {stylist.charAt(0)}
                  </div>
                  <div className={styles.stylistInfo}>
                    <h4>{stylist}</h4>
                    <p>{data.count} appointments</p>
                    <p className={styles.stylistRevenue}>
                      ₱{data.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Recent Completed Appointments</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Stylist</th>
                  <th>Services</th>
                  <th>Payment</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={styles.emptyState}>
                      No completed appointments found for the selected period
                    </td>
                  </tr>
                ) : (
                  filteredData.map(appointment => {
                    const services = Array.isArray(appointment.services) ? appointment.services : [];
                    return (
                      <tr key={appointment.id}>
                        <td className={styles.orderNumber}>{appointment.order_number}</td>
                        <td>{formatDate(appointment.appointment_date)}</td>
                        <td>{appointment.client_name}</td>
                        <td>{appointment.stylist}</td>
                        <td>
                          <div className={styles.servicesList}>
                            {services.map((service, idx) => (
                              <span key={idx} className={styles.serviceBadge}>
                                {service.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={styles.paymentBadge}>
                            {appointment.payment_method}
                          </span>
                        </td>
                        <td className={styles.amount}>
                          ₱{parseFloat(appointment.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;