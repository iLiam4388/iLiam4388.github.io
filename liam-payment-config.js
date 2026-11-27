// Public configuration only. Never put a Stripe secret/restricted key here.
export const paymentConfig={backendUrl:'https://iliam-payments.onrender.com',publishableKey:"pk_test_51UgBraDsIK4EIFRWhO5tqlPZSF0XhFZ8hIPCflDtNJJE7uY0TvNPz9xm28b3GPJBYVlmALFk0MWAoMIiw5hh4fzy00veH1Cm1j",sandbox:true};
// Hosted Checkout does not require a publishable key. Set backendUrl to the deployed HTTPS sandbox backend.

// Staged public configuration only. Not used by the sandbox checkout.
// Keep disabled until the separate live backend, webhook, wallet and eligibility checks are complete.
export const livePaymentConfig=Object.freeze({enabled:false,backendUrl:'',publishableKey:'pk_live_51UgCtQRhleDBPmLZcOWpa0i1ol9xvbFiqvLO3OALXBQ6WhKfhacLJGhUPkEY6xgoYK67xg4YEmmO9k4Nt8ex6LjM00mfXa6rVi'});
