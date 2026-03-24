import UIKit

class UpgradeViewController: UIViewController {
    func openPremiumLink() {
        if let url = URL(string: "https://example.com/subscribe") {
            UIApplication.shared.open(url)
        }
    }
}
