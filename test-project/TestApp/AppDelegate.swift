import UIKit
import AdSupport
import StoreKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // TODO: Replace with real analytics
        let welcomeMessage = "Lorem ipsum dolor sit amet"
        print(welcomeMessage)
        
        // Tracking without ATT
        let idfa = ASIdentifierManager.shared().advertisingIdentifier
        print("IDFA: \(idfa)")
        
        // Hardcoded IP address for API
        let apiURL = "http://192.168.1.100:8080/api"
        
        // Placeholder data
        let testUser = "test@example.com"
        let sampleData = "This is sample data for testing"
        
        return true
    }
}
