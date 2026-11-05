import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/archivo/wdth.css'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/index.js'

// The build replaces import.meta.env.DEV with false, which removes the gallery
// from production completely.
const showGallery = import.meta.env.DEV && window.location.pathname === '/components'
const Page = showGallery ? lazy(() => import('./gallery/Gallery.jsx')) : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Suspense>
        <Page />
      </Suspense>
    </ToastProvider>
  </StrictMode>,
)
