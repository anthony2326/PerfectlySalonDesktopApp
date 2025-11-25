// Inventory.jsx
"use client"

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import styles from './Inventory.module.css';
import { Package, Plus, Search, Edit2, Trash2, AlertCircle, X } from 'lucide-react';
import supabase from '../../../../utils/supabase';

const Inventory = ({ logoSrc, logoAlt, onNavigate, onLogout }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '',
    min_stock: ''
  });

  const categories = ['Hair Care', 'Hair Color', 'Nail Color', 'Nail Care', 'Skincare', 'Supplies', 'Tools', 'Others'];

  // ✅ UPDATED: Added "Item" to units
  const units = [
    'bottles',
    'boxes',
    'jars',
    'pieces',
    'sets',
    'tubes',
    'item'  // ✅ NEW: Added "item"
  ];

  // Fetch inventory from Supabase
  useEffect(() => {
    fetchInventory();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        (payload) => {
          console.log('[REALTIME] Inventory changed, refreshing...', payload);
          fetchInventory();
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME] Inventory subscription status:', status);
      });

    return () => {
      console.log('[REALTIME] Unsubscribing from inventory changes');
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('category')
        .order('name');

      if (error) throw error;

      console.log('[SUCCESS] Fetched inventory:', data);
      setItems(data || []);
    } catch (err) {
      console.error('[ERROR] Failed to fetch inventory:', err);
      alert('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = items.filter(item => item.quantity <= item.min_stock);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        min_stock: item.min_stock
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: 'Hair Care',
        quantity: '',
        unit: 'bottles',
        min_stock: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'Hair Care',
      quantity: '',
      unit: 'bottles',
      min_stock: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.quantity || !formData.min_stock) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const itemData = {
        name: formData.name,
        category: formData.category,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        min_stock: Number(formData.min_stock)
      };

      if (editingItem) {
        // Update existing item
        const { data, error } = await supabase
          .from('inventory')
          .update(itemData)
          .eq('id', editingItem.id)
          .select()
          .single();

        if (error) throw error;
        console.log('[SUCCESS] Item updated:', data);
        alert('✅ Item updated successfully!');
      } else {
        // Insert new item
        const { data, error } = await supabase
          .from('inventory')
          .insert([itemData])
          .select();

        if (error) throw error;
        console.log('[SUCCESS] Item added:', data);
        alert('✅ Item added successfully!');
      }

      handleCloseModal();
      await fetchInventory();
    } catch (err) {
      console.error('[ERROR] Failed to save item:', err);
      alert(`❌ Failed to save item: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log('[SUCCESS] Item deleted');
      alert('✅ Item deleted successfully!');
      await fetchInventory();
    } catch (err) {
      console.error('[ERROR] Failed to delete item:', err);
      alert(`❌ Failed to delete item: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Sidebar 
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          currentPage="Inventory"
          onNavigate={onNavigate}
          onLogout={onLogout}
        />
        <div className={styles.mainContent}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading inventory...</p>
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
        currentPage="Inventory"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>Inventory Management</h1>
            <p className={styles.subtitle}>Track and manage your salon supplies</p>
          </div>
          <button className={styles.addButton} onClick={() => handleOpenModal()}>
            <Plus size={20} />
            Add New Item
          </button>
        </div>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }}>
              <Package size={24} />
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Total Items</p>
              <p className={styles.statValue}>{items.length}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <AlertCircle size={24} />
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Low Stock Alert</p>
              <p className={styles.statValue}>{lowStockItems.length}</p>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <div className={styles.alertBox}>
            <AlertCircle size={20} />
            <div>
              <strong>Low Stock Alert:</strong> {lowStockItems.length} item(s) need restocking
              <div className={styles.lowStockList}>
                {lowStockItems.map(item => (
                  <span key={item.id}>{item.name} ({item.quantity} {item.unit})</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={styles.controls}>
          <div className={styles.searchBox}>
            <Search size={20} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className={styles.filterSelect}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Inventory Table */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Min Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles.emptyState}>
                    No items found
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className={item.quantity <= item.min_stock ? styles.lowStockRow : ''}>
                    <td className={styles.itemName}>{item.name}</td>
                    <td>
                      <span className={styles.categoryBadge}>{item.category}</span>
                    </td>
                    <td>
                      <span className={item.quantity <= item.min_stock ? styles.lowStock : ''}>
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td>{item.min_stock} {item.unit}</td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button 
                          className={styles.editBtn}
                          onClick={() => handleOpenModal(item)}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className={styles.modalOverlay} onClick={handleCloseModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                <button className={styles.closeBtn} onClick={handleCloseModal}>
                  <X size={24} />
                </button>
              </div>
              <div className={styles.formContainer}>
                <div className={styles.formGroup}>
                  <label>Item Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Shampoo - Moisturizing"
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Unit *</label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                    >
                      {units.map(unit => (
                        <option key={unit} value={unit}>
                          {unit.charAt(0).toUpperCase() + unit.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Quantity *</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Min Stock Level *</label>
                    <input
                      type="number"
                      name="min_stock"
                      value={formData.min_stock}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button className={styles.cancelBtn} onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button className={styles.submitBtn} onClick={handleSubmit}>
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;