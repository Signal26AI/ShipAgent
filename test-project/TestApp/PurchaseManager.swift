import Foundation
import StoreKit

class PurchaseManager {
    
    static let shared = PurchaseManager()
    
    // Premium features unlocked via external payment
    func unlockPremium() {
        // TODO: Implement IAP - currently using Stripe
        let stripeURL = "https://checkout.stripe.com/pay/premium"
        if let url = URL(string: stripeURL) {
            // Open in browser for payment
            UIApplication.shared.open(url)
        }
    }
    
    // No restore purchases implemented yet
    // TODO: Add restore functionality
    
    func showSubscriptionTerms() {
        // Price: $9.99/month, auto-renews
        // Terms not clearly displayed to user
        let price = "$9.99"
    }
}
