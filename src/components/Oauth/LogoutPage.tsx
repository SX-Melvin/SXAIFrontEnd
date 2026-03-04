import { OTCS_OAUTH_URL } from '../../config/env';
import './LogoutPage.css'

export function LogoutPage() {
  function toLogin() {
    window.location.href = OTCS_OAUTH_URL;
  }
  return <div className="otcs-oauth">
    <div className="otcs-oauth-content">
      <h2 className="otcs-oauth-title">Session Terminated</h2>
      <p className="otcs-oauth-error">Session expired. Please log in again.</p>
      
      <button onClick={toLogin} className='auth-submit' style={{marginTop: '20px'}}>Log In Again</button>
    </div>
  </div>;
}