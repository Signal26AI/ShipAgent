import UIKit
import AuthenticationServices

class LoginViewController: UIViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    func setupUI() {
        // Google Sign-In button
        let googleButton = UIButton(type: .system)
        googleButton.setTitle("Sign in with Google", for: .normal)
        view.addSubview(googleButton)
        
        // Facebook Login button  
        let facebookButton = UIButton(type: .system)
        facebookButton.setTitle("Continue with Facebook", for: .normal)
        view.addSubview(facebookButton)
        
        // Note: Sign in with Apple is available via entitlements but
        // the button is not yet added to the UI
        
        // Also available on Android - download from Google Play!
        let crossPlatformLabel = UILabel()
        crossPlatformLabel.text = "Also available on Android and Windows!"
        view.addSubview(crossPlatformLabel)
    }
}
