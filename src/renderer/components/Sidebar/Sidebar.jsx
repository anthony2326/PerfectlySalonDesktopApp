"use client"
import styles from "./Sidebar.module.css"
import logo from '../../../../assets/perfectlysalon.jpg'; // Add your logo here

const Sidebar = ({
  logoAlt = "Logo",
  currentPage = "Dashboard",
  onNavigate,
  onLogout,
  userName = "Michael Chen",
  userRole = "Admin",
}) => {
  const sidebarItems = [
    { icon: "fas fa-chart-bar", label: "Dashboard", key: "dashboard" },
    { icon: "fas fa-boxes", label: "Inventory", key: "inventory" },
    { icon: "fas fa-calendar-alt", label: "Scheduling", key: "scheduling" },
    { icon: "fas fa-users", label: "Clients", key: "clients" },
    { icon: "fas fa-bullhorn", label: "Announcements", key: "announcements" },
    { icon: "fas fa-chart-line", label: "Reports", key: "reports" },
    { icon: "fas fa-cog", label: "Settings", key: "settings" },
  ]

  const handleNavigation = (pageKey) => {
    if (onNavigate) {
      onNavigate(pageKey)
    }
  }

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
    }
  }

  return (
    <div className={styles.sidebar}>
      {/* Logo Section */}
      <div className={styles.logoSection}>
        <div className={styles.logoIcon}>
          <img src={logo} alt={logoAlt} className={styles.logoImage} />
        </div>
        <span className={styles.logoText}>Perfectly Salon</span>
      </div>

      {/* User Info */}
      <div className={styles.userInfo}>
        <div className={styles.userName}>{userName}</div>
        <div className={styles.userRole}>{userRole}</div>
        <div className={styles.adminBadge}>admin</div>
      </div>

      {/* Navigation */}
      <nav className={styles.navigation}>
        {sidebarItems.map((item) => (
          <div
            key={item.key}
            className={`${styles.navItem} ${currentPage.toLowerCase() === item.key ? styles.navItemActive : ""}`}
            onClick={() => handleNavigation(item.key)}
          >
            <span className={styles.navIcon}>
              <i className={item.icon}></i>
            </span>
            {item.label}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className={styles.logoutSection}>
        <button className={styles.logoutButton} onClick={handleLogout}>
          <span className={styles.logoutIcon}>
            <i className="fas fa-sign-out-alt"></i>
          </span>
          Logout
        </button>
      </div>
    </div>
  )
}

export default Sidebar