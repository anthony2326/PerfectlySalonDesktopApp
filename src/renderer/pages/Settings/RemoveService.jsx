// RemoveService.jsx
import React, { useState, useEffect } from 'react';
import styles from './RemoveService.module.css';
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

const RemoveService = ({ onBack }) => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingServiceId, setDeletingServiceId] = useState(null);

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

  const handleRemoveService = (service) => {
    if (window.confirm(`Are you sure you want to remove "${service.name}"? This action cannot be undone.`)) {
      confirmRemoveService(service.id);
    }
  };

  const confirmRemoveService = async (serviceId) => {
    setDeletingServiceId(serviceId);

    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', serviceId);

      if (error) throw error;

      // Update local state - remove the service from the category
      setCategories(prevCategories =>
        prevCategories.map(category => ({
          ...category,
          services: category.services.filter(service => service.id !== serviceId)
        }))
      );

      alert('Service removed successfully!');
    } catch (error) {
      console.error('Error removing service:', error);
      alert('Failed to remove service: ' + error.message);
    } finally {
      setDeletingServiceId(null);
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
        <h1 className={styles.headerTitle}>Remove Service</h1>
        <div className={styles.headerRight}></div>
      </div>

      <div className={styles.scrollView}>
        <div className={styles.contentContainer}>
          {/* Warning Message */}
          <div className={styles.warningBox}>
            <i className="fas fa-exclamation-triangle"></i>
            <p className={styles.warningText}>
              Removing a service will hide it from your service list. This action cannot be undone.
            </p>
          </div>

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
                      <p className={styles.priceText}>₱{service.price.toFixed(2)}</p>
                    </div>

                    <button
                      className={`${styles.removeButton} ${
                        deletingServiceId === service.id ? styles.removeButtonDisabled : ''
                      }`}
                      onClick={() => handleRemoveService(service)}
                      disabled={deletingServiceId === service.id}
                    >
                      {deletingServiceId === service.id ? (
                        <div className={styles.smallSpinner}></div>
                      ) : (
                        <>
                          <i className="fas fa-trash-alt"></i>
                          <span>Remove</span>
                        </>
                      )}
                    </button>
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

export default RemoveService;