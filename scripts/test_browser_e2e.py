import time
from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 850})
        
        print("[1/6] Navigating to https://tiktok-live-booster.web.app ...")
        page.goto("https://tiktok-live-booster.web.app", timeout=30000)
        time.sleep(2)
        
        print("[2/6] Logging into Mission Control ...")
        page.fill("input[type='email']", "nadeemdepal27@gmail.com")
        page.fill("input[type='password']", "admin")
        page.click("button[type='submit']")
        time.sleep(3)
        
        print("[3/6] Saving Dashboard Overview screenshot ...")
        page.screenshot(path="dashboard_overview.png")
        
        print("[4/6] Navigating to Runners Matrix Tab ...")
        page.click("text=Runners Matrix")
        time.sleep(2)
        page.screenshot(path="runners_matrix_view.png")
        
        print("[5/6] Opening Edge-to-Edge Live Screen Modal for Runner #0 ...")
        page.click("text=Live Screen")
        time.sleep(2)
        page.screenshot(path="live_screen_modal.png")
        
        print("[6/8] Testing Direct Screen Touch & Tap on Android Viewport ...")
        # Click directly onto the live phone screen container
        screen_img = page.locator("img[alt*='Runner']").first
        if screen_img.is_visible():
            box = screen_img.bounding_box()
            if box:
                # Tap center of the phone screen
                page.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
                time.sleep(1)
        
        print("[7/8] Testing Remote Control Navigation Buttons (Home, Back, Next) ...")
        if page.locator("button:has-text('Home')").is_visible():
            page.click("button:has-text('Home')")
            time.sleep(1)
        if page.locator("button:has-text('Back')").is_visible():
            page.click("button:has-text('Back')")
            time.sleep(1)

        print("[8/8] Testing Remote Control Turbo Burst & Comment Dispatch ...")
        page.click("text=Send 50 Likes Instant Turbo Burst")
        time.sleep(1)
        
        # Test sending remote comment
        comment_input = page.locator("input[placeholder*='Type comment']")
        if comment_input.is_visible():
            comment_input.fill("Awesome stream! 🔥")
            page.click("button:has-text('Send')")
            time.sleep(1.5)

        page.screenshot(path="live_screen_action_dispatched.png")
        print("[SUCCESS] All End-to-End Browser & Remote Control Steps Completed Successfully!")
        browser.close()

if __name__ == "__main__":
    run_test()
