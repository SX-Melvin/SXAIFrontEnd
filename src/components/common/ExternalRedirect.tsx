import { useEffect } from "react"

export function ExternalRedirect({ url }: { url: string }) {
  useEffect(() => {
    window.location.replace(url)
  }, [url])

  return null
}