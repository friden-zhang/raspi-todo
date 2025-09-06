import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import Admin from './pages/Admin'
import Display from './pages/Display'
import MyDay from './pages/MyDay'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Admin /> },
      { path: 'admin', element: <Admin /> },
      { path: 'display', element: <Display /> },
      { path: 'my-day', element: <MyDay /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
