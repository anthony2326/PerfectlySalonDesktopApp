// ChangePrice.jsx
import React, { useState, useEffect } from 'react';
import styles from './ChangePrice.module.css';
import supabase from '../../../../utils/supabase'; // Adjust path as needed

const CATEGORY_COLORS = {
  hair: '#dc2626',
  nails: '#db2777',
  waxing: '#9333ea',
  facial: '#2563eb',
  footcare: '#16a34a',
  lashes: '#d97706',
};

const CATEGORY_ICONS = {
  hair: 'fa-cut',
  nails: 'fa-hand-paper',
  waxing: 'fa-spa',
  facial: 'fa-smile',
  footcare: 'fa-shoe-prints',
  lashes: 'fa-eye',
};

const ChangePrice = ({ onBack }) => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchServicesWithCategories();
  }, []);

  const fetchServicesWithCategories = async () => {
    try {
      setIsLoading(true);
      
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (categoriesError) throw categoriesError;

      // Fetch services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (servicesError) throw servicesError;

      // Group services by category
      const categoryMap = {};
      categoriesData.forEach(cat => {
        categoryMap[cat.id] = {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          services: []
        };
      });

      servicesData.forEach(service => {
        if (categoryMap[service.category_id]) {
          categoryMap[service.category_id].services.push(service);
        }
      });

      setCategories(Object.values(categoryMap));
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load services: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPrice = (serviceId, currentPrice) => {
    setEditingServiceId(serviceId);
    setEditPrice(currentPrice.toString());
  };

  const handleCancelEdit = () => {
    setEditingServiceId(null);
    setEditPrice('');
  };

  const handleSavePrice = async (serviceId) => {
    if (!editPrice || editPrice.trim() === '') {
      alert('Please enter a valid price');
      return;
    }

    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Please enter a valid number');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('services')
        .update({ price: newPrice })
        .eq('id', serviceId);

      if (error) throw error;

      // Update local state
      setCategories(prevCategories =>
        prevCategories.map(category => ({
          ...category,
          services: category.services.map(service =>
            service.id === serviceId
              ? { ...service, price: newPrice }
              : service
          )
        }))
      );

      setEditingServiceId(null);
      setEditPrice('');
      alert('Price updated successfully!');
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerContainer}>
        <button onClick={onBack} className={styles.backButton}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className={styles.headerTitle}>Change Price</h1>
        <div className={styles.headerRight}></div>
      </div>

      <div className={styles.scrollView}>
        <div className={styles.contentContainer}>
          {categories.map((category) => (
            <div key={category.id} className={styles.categorySection}>
              {/* Category Header */}
              <div className={styles.categoryHeader}>
                <div 
                  className={styles.categoryIconContainer}
                  style={{ backgroundColor: (CATEGORY_COLORS[category.slug] || '#6b7280') + '20' }}
                >
                  <i 
                    className={`fas ${CATEGORY_ICONS[category.slug] || 'fa-star'}`}
                    style={{ color: CATEGORY_COLORS[category.slug] || '#6b7280' }}
                  ></i>
                </div>
                <div className={styles.categoryInfo}>
                  <h2 className={styles.categoryName}>{category.name}</h2>
                  <p className={styles.categoryCount}>
                    {category.services.length} {category.services.length === 1 ? 'service' : 'services'}
                  </p>
                </div>
              </div>

              {/* Services List */}
              {category.services.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyStateText}>No services in this category</p>
                </div>
              ) : (
                category.services.map((service) => (
                  <div key={service.id} className={styles.serviceCard}>
                    <div className={styles.serviceInfo}>
                      <h3 className={styles.serviceName}>{service.name}</h3>
                      {service.subtitle && (
                        <p className={styles.serviceSubtitle}>{service.subtitle}</p>
                      )}
                    </div>

                    {editingServiceId === service.id ? (
                      // Edit Mode
                      <div className={styles.editContainer}>
                        <div className={styles.priceInputContainer}>
                          <span className={styles.currencySymbol}>₱</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className={styles.priceInput}
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className={styles.editActions}>
                          <button
                            className={`${styles.actionButton} ${styles.cancelButton}`}
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                          <button
                            className={`${styles.actionButton} ${styles.saveActionButton}`}
                            onClick={() => handleSavePrice(service.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <div className={styles.smallSpinner}></div>
                            ) : (
                              <i className="fas fa-check"></i>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className={styles.priceContainer}>
                        <span className={styles.priceText}>₱{service.price.toFixed(2)}</span>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEditPrice(service.id, service.price)}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChangePrice;