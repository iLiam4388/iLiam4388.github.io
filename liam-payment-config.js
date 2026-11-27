// Public configuration only. Never put a Stripe secret/restricted key here.
export const paymentConfig={backendUrl:'',publishableKey:'',sandbox:true};
// Hosted Stripe Checkout does not need the publishable key for this redirect flow.
// Set backendUrl to the HTTPS URL of the deployed sandbox backend.
