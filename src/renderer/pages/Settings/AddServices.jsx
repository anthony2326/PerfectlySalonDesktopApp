// AddServices.jsx
import React, { useState, useEffect } from 'react';
import styles from './AddServices.module.css';
import supabase from '../../../../utils/supabase'; // Adjust path as needed

const getIconForCategory = (slug) => {
  const icons = {
    hair: 'fa-cut',
    nails: 'fa-hand-paper',
    waxing: 'fa-spa',
    facial: 'fa-smile',
    footcare: 'fa-shoe-prints',
    lashes: 'fa-eye',
  };
  return icons[slug] || 'fa-star';
};

const getColorForCategory = (slug) => {
  const colors = {
    hair: '#dc2626',
    nails: '#db2777',
    waxing: '#9333ea',
    facial: '#2563eb',
    footcare: '#16a34a',
    lashes: '#d97706',
  };
  return colors[slug] || '#6b7280';
};

const AddServices = ({ onBack }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [serviceName, setServiceName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCategories, setIsFetchingCategories] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setIsFetchingCategories(true);
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;

      const mappedCategories = data.map(cat => ({
        id: cat.slug,
        name: cat.name,
        icon: getIconForCategory(cat.slug),
        color: getColorForCategory(cat.slug),
        categoryId: cat.id,
      }));

      setCategories(mappedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      alert('Failed to load categories');
    } finally {
      setIsFetchingCategories(false);
    }
  };

  const handleSaveService = async () => {
    // Validation
    if (!selectedCategory) {
      alert('Please select a category');
      return;
    }
    if (!serviceName.trim()) {
      alert('Please enter a service name');
      return;
    }
    if (!price.trim()) {
      alert('Please enter a price');
      return;
    }

    setIsLoading(true);

    try {
      const serviceData = {
        category_id: selectedCategory.categoryId,
        name: serviceName.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        price: parseFloat(price),
        duration: duration.trim() ? parseInt(duration) : null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('services')
        .insert([serviceData])
        .select();

      if (error) throw error;

      alert('Service added successfully!');
      
      // Clear form
      setSelectedCategory(null);
      setServiceName('');
      setSubtitle('');
      setDescription('');
      setPrice('');
      setDuration('');
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Failed to save service: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingCategories) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Loading categories...</p>
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
        <h1 className={styles.headerTitle}>Add New Service</h1>
        <div className={styles.headerRight}></div>
      </div>

      <div className={styles.scrollView}>
        <div className={styles.contentContainer}>
          {/* Category Selection */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Select Category *</h2>
            <div className={styles.categoryGrid}>
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={`${styles.categoryCard} ${
                    selectedCategory?.id === category.id ? styles.categoryCardSelected : ''
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  <div 
                    className={styles.categoryIcon}
                    style={{ backgroundColor: category.color + '20' }}
                  >
                    <i className={`fas ${category.icon}`} style={{ color: category.color }}></i>
                  </div>
                  <span className={styles.categoryName}>{category.name}</span>
                  {selectedCategory?.id === category.id && (
                    <div className={styles.checkmark}>
                      <i className="fas fa-check-circle"></i>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Service Details Form */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Service Details</h2>

            {/* Service Name */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Service Name *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g., Basic Haircut"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              />
            </div>

            {/* Subtitle */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Subtitle (Optional)</label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g., Full Set, Fill Design"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Description (Optional)</label>
              <textarea
                className={`${styles.input} ${styles.textArea}`}
                placeholder="Enter service description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Price and Duration Row */}
            <div className={styles.row}>
              {/* Price */}
              <div className={`${styles.inputGroup} ${styles.halfWidth}`}>
                <label className={styles.label}>Price (₱) *</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  step="0.01"
                />
              </div>

              {/* Duration */}
              <div className={`${styles.inputGroup} ${styles.halfWidth}`}>
                <label className={styles.label}>Duration (minutes)</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="30"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            className={`${styles.saveButton} ${isLoading ? styles.saveButtonDisabled : ''}`}
            onClick={handleSaveService}
            disabled={isLoading}
          >
            {isLoading ? (
              <span>Saving...</span>
            ) : (
              <>
                <i className="fas fa-check-circle"></i>
                <span>Save Service</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddServices;