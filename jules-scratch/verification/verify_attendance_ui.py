import time
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Go to the root page, which now renders AttendancePage
        page.goto("http://localhost:5173", timeout=30000)

        # Wait for the main heading of the attendance page to be visible
        heading = page.get_by_role("heading", name="Pendataan Absensi")
        expect(heading).to_be_visible(timeout=15000)

        # Wait for the student list to populate. We can check for the first student's card.
        # Since there's no data, it will likely show the loading state or empty state.
        # Let's just wait for a bit to ensure all components have rendered after loading.
        time.sleep(3) # Wait for animations and data loading to settle

        # Take a screenshot
        screenshot_path = "jules-scratch/verification/attendance_page_redesign.png"
        page.screenshot(path=screenshot_path, full_page=True)

        print(f"Screenshot saved to {screenshot_path}")

    except Exception as e:
        print(f"An error occurred: {e}")
        # Take a screenshot even on error for debugging
        page.screenshot(path="jules-scratch/verification/error.png", full_page=True)

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)
