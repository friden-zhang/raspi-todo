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

import React from 'react'
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

  return (
    <div>
      {/* Header with navigation */}
      <header>
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Application title/brand */}
          <div>
            <strong>RasPi TODO</strong>
          </div>

          {/* Navigation menu */}
          <nav style={{ display: 'flex', gap: 12 }}>
            {/* Admin link - bold when active (current route) */}
            <Link
              to="/admin"
              style={{
                fontWeight:
                  pathname.startsWith('/admin') || pathname === '/'
                    ? 'bold'
                    : 'normal',
              }}
            >
              Admin
            </Link>

            {/* Display/Dashboard link - bold when active */}
            <Link
              to="/display"
              style={{
                fontWeight: pathname.startsWith('/display') ? 'bold' : 'normal',
              }}
            >
              Board
            </Link>
          </nav>
        </div>
      </header>

      {/* Outlet = Sub-route render point */}
      {/* This is where child components (Admin, Display pages) will be rendered */}
      {/* Similar to a placeholder or slot in template systems */}
      <Outlet />
    </div>
  )
}
