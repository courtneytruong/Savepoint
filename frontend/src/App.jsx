import { useEffect, useState } from 'react'

const MESSAGES = {
  checking: 'Checking...',
  connected: 'All systems connected',
  databaseUnreachable: "The API is up, but it can't reach the database",
  apiUnreachable: "Can't reach the API",
}

async function checkHealth(signal) {
  const response = await fetch('/health', { signal })
  const body = await response.text()

  // Checking the body as well means an unexpected page, such as an error page
  // from a proxy, can't be mistaken for a real answer from the API.
  if (response.status === 200 && body === 'Healthy') return 'connected'
  if (response.status === 503 && body === 'Unhealthy') return 'databaseUnreachable'
  return 'apiUnreachable'
}

function App() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const controller = new AbortController()

    checkHealth(controller.signal)
      .then(setStatus)
      .catch((error) => {
        // An abort means the page cleaned up this request, not that it failed.
        if (error.name !== 'AbortError') setStatus('apiUnreachable')
      })

    return () => controller.abort()
  }, [])

  return (
    <main>
      <h1>Savepoint</h1>
      <p className={`status status-${status}`} role="status">
        {MESSAGES[status]}
      </p>
    </main>
  )
}

export default App
