import UIKit
import GoogleSignIn

class LoginViewController: UIViewController {
    func signInWithGoogle() {
        GIDSignIn.sharedInstance.signIn(withPresenting: self)
    }
    // No Sign in with Apple option!
}
