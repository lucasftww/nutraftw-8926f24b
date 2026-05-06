# Mobile QA Checklist (Admin/Catalog/Product/Checkout)

Use this on real devices (Android and iOS) before deploy.

## 1) Admin

- Login as admin and open `Produtos`.
- Create product with all required fields and save once (no double-save).
- Edit product + upload image, close modal quickly during upload, confirm modal does not reopen.
- Duplicate product and verify new draft appears.
- Delete a product on the last row of a page and confirm pagination remains correct.
- Test bulk actions: activate/deactivate, stock set/inc, price set/inc, delete.
- Validate touch targets in list rows and modal footer buttons.

## 2) Catalog

- Open catalog on 360px and 390px widths.
- Confirm no horizontal scroll.
- Open filter drawer and verify `Promoções` appears when promotions exist.
- Apply search + category filters and validate cards remain aligned.
- Confirm image ratio and price/button alignment in first 8 cards.

## 3) Product Detail

- Open product with long title and check wrapping.
- Verify hero image and related images are not cropped badly.
- Test back button from direct URL and from in-app navigation.
- Add to cart from main CTA and sticky CTA.
- Verify sticky footer CTA remains usable with keyboard open.

## 4) Checkout

- Fill buyer + address fields on mobile keyboard.
- Ensure sticky `Continuar` scrolls to missing section (buyer/address/shipping/payment).
- Set cart qty to max and verify `+` button disables at 100.
- Validate shipping selection and total updates.
- Submit order with PIX and card options; confirm order is created and redirect works.
- If payment gateway is configured, confirm redirect to provider checkout URL.

## 5) Regression pass (desktop)

- Repeat critical flows on 1366x768:
  - Admin product CRUD and bulk actions.
  - Catalog filters/search and card consistency.
  - Product detail CTA and related products.
  - Checkout full completion and order creation.
