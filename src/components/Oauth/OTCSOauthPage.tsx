import { useEffect, useState } from "react"
import './OTCSOauthPage.css'
import { loginWithOTCSToken } from "../../services/auth"
import { BYPASS_AUTH } from "../../config/env"
import { constructLink } from "../../utils/construct_link"

export function OTCSOauthPage() {
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    getAccessToken()
  }, [])

  async function getAccessToken() {
    // This is a development bypass to allow logging in without going through the OTCS OAuth flow, which can be time-consuming to test against. In production, this block will be skipped and the component will look for an access token in the URL hash as expected.
    console.log("BYPASS_AUTH:", BYPASS_AUTH);
    if(BYPASS_AUTH) {
      const req = await loginWithOTCSToken("");
      if(req.errorMessage != null) {
        setErrorMessage(req.errorMessage);
        return;
      }
      window.location.href = constructLink("/");
      return;
    }

    // Check if we're returning from OTCS OAuth flow with an access token in the URL hash
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      // Extract access token from URL hash and store it in localStorage
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      if (accessToken) {
        try {
          window.opener.postMessage({ type: 'otcs_token', access_token: accessToken }, '*')
        } catch (error) {
          console.warn('No window opener available', error)
        }
        localStorage.setItem('otcs_token', accessToken);
        const req = await loginWithOTCSToken(accessToken);
        if(req.errorMessage != null) {
          setErrorMessage(req.errorMessage);
          return;
        }
        window.location.href = constructLink("/");
      }
    }
  }

  return <div className="otcs-oauth">
    <div className="otcs-oauth-content">
      <h2 className="otcs-oauth-title">Logging you in...</h2>
      {
        errorMessage && <p className="otcs-oauth-error">{errorMessage}</p>
      }
      {
        errorMessage == '' && <p className="otcs-oauth-message">Please wait while we authenticate your session.</p>
      }
    </div>
  </div>;
}