// Settings.jsx
import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar/Sidebar';
import AddServices from '../Settings/AddServices';
import ChangePrice from '../Settings/ChangePrice';
import RemoveService from '../Settings/RemoveService';
import styles from './Settings.module.css';

const Settings = ({ logoSrc, logoAlt, onNavigate, onLogout }) => {
  const [activeView, setActiveView] = useState(null); // null, 'add', 'change', 'remove'

  const handleCardClick = (view) => {
    setActiveView(view);
  };

  const handleCloseView = () => {
    setActiveView(null);
  };

  return (
    <div className={styles.container}>
      <Sidebar 
        logoSrc={logoSrc}
        logoAlt={logoAlt}
        currentPage="Settings"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <div className={styles.mainContent}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.subtitle}>Manage your salon services and configuration</p>
        </div>

        <div className={styles.content}>
          {/* Service Management Cards */}
          <div className={styles.cardsSection}>
            <h3 className={styles.sectionTitle}>Service Management</h3>
            
            <div className={styles.cardsGrid}>
              {/* Add New Services Card */}
              <div 
                className={`${styles.card} ${activeView === 'add' ? styles.cardActive : ''}`}
                onClick={() => handleCardClick('add')}
              >
                <div className={`${styles.cardIcon} ${styles.iconBlue}`}>
                  <i className="fas fa-plus-circle"></i>
                </div>
                <div className={styles.cardCount}>Add</div>
                <div className={styles.cardLabel}>New Services</div>
              </div>

              {/* Change Price Card */}
              <div 
                className={`${styles.card} ${activeView === 'change' ? styles.cardActive : ''}`}
                onClick={() => handleCardClick('change')}
              >
                <div className={`${styles.cardIcon} ${styles.iconGreen}`}>
                  <i className="fas fa-tag"></i>
                </div>
                <div className={styles.cardCount}>Update</div>
                <div className={styles.cardLabel}>Change Price</div>
              </div>

              {/* Remove Service Card */}
              <div 
                className={`${styles.card} ${activeView === 'remove' ? styles.cardActive : ''}`}
                onClick={() => handleCardClick('remove')}
              >
                <div className={`${styles.cardIcon} ${styles.iconRed}`}>
                  <i className="fas fa-trash-alt"></i>
                </div>
                <div className={styles.cardCount}>Delete</div>
                <div className={styles.cardLabel}>Remove Service</div>
              </div>
            </div>
          </div>

          {/* Bottom Screen Display */}
          {activeView && (
            <div className={styles.bottomScreen}>
              <div className={styles.bottomScreenHeader}>
                <h3 className={styles.bottomScreenTitle}>
                  {activeView === 'add' && 'Add New Services'}
                  {activeView === 'change' && 'Change Price'}
                  {activeView === 'remove' && 'Remove Service'}
                </h3>
                <button 
                  className={styles.closeButton}
                  onClick={handleCloseView}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
              
              <div className={styles.bottomScreenContent}>
                {activeView === 'add' && <AddServices onBack={handleCloseView} />}
                {activeView === 'change' && <ChangePrice onBack={handleCloseView} />}
                {activeView === 'remove' && <RemoveService onBack={handleCloseView} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;