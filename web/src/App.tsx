/**
 * Main Application Component
 *
 * This is the root component of the React application. It provides:
 * - Navigation header with links to different pages
 * - Outlet for nested routes (similar to template inheritance)
 *
 * React Patterns Demonstrated:
 * - Functional components with hooks (modern React style)
 * - Client-side routing (SPA - Single Page Application)
 * - Conditional rendering and styling
 *
 * Think of this as the main window/frame in a C++ GUI application
 */

import React, { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

/**
 * App Component - Root of the application
 *
 * This component serves as the main layout container.
 * The useLocation hook provides current route information for active styling.
 *
 * Pattern: Template Method - defines the overall structure,
 * with specific content filled in by child routes
 */
export default function App() {
  // Get current location/route for navigation highlighting
  // Similar to checking current state in a state machine
  const { pathname } = useLocation()

  // Initialize Lucide icons when component mounts
  useEffect(() => {
    // @ts-ignore - Lucide is loaded via CDN
    if (window.lucide) {
      // @ts-ignore
      window.lucide.createIcons()
    }
  })

  return (
    <div>
      {/* Header with navigation */}
      <header>
        <div className="container">
          <div className="header-content">
            {/* Application title/brand */}
            <div className="logo">
              <div className="logo-icon">
                <i
                  data-lucide="check-square"
                  style={{ width: 20, height: 20 }}
                ></i>
              </div>
              <span>RasPi TODO</span>
            </div>

            {/* Navigation menu */}
            <nav>
              {/* Admin link - active when on admin or root route */}
              <Link
                to="/admin"
                className={`nav-link ${
                  pathname.startsWith('/admin') || pathname === '/'
                    ? 'active'
                    : ''
                }`}
              >
                <i data-lucide="settings" style={{ width: 16, height: 16 }}></i>
                <span>管理面板</span>
              </Link>

              {/* Display/Dashboard link - active when on display route */}
              <Link
                to="/display"
                className={`nav-link ${
                  pathname.startsWith('/display') ? 'active' : ''
                }`}
              >
                <i data-lucide="monitor" style={{ width: 16, height: 16 }}></i>
                <span>看板视图</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Outlet = Sub-route render point */}
      {/* This is where child components (Admin, Display pages) will be rendered */}
      {/* Similar to a placeholder or slot in template systems */}
      <Outlet />
    </div>
  )
}
