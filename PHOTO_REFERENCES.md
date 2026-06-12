# Photo Reference Ideas

These notes preserve the photo-example ideas provided during planning without copying third-party screenshots directly into the site.

## Useful Example Categories

- Correct photo: plain white/off-white background, neutral expression, face forward, both eyes open.
- No glasses: eyeglasses, sunglasses, and tinted lenses should be removed.
- No hats: hats/head coverings are not allowed unless worn daily for religious purposes and the full face is visible.
- No busy background: no furniture, plants, maps, objects, patterns, shadows, or dark background.
- No tilt: applicant should not lean forward, backward, or sideways.
- No smile/exaggerated expression: neutral expression is safest.
- No overexposure or shadows: lighting should be even and natural.
- No blur or low-quality compression.
- Correct framing: square photo, head centered, shoulders visible, top of head and chin within official composition range.

## Official Sources To Use

- Photo examples:
  https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/photo-examples.html
- Photo composition template:
  https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/photo-composition-template.html
- Digital image requirements:
  https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html

## Implementation Decision

Use official Department of State visual examples and composition templates directly where possible. The user-provided screenshots are useful as direction, but we should avoid embedding screenshots from unknown pages unless we confirm the original source and usage rights.

Current website implementation uses:

- Individual 600 x 800 example portraits in `assets/images/photo-examples/good-1.jpg` through `good-4.jpg` and `bad-1.jpg` through `bad-4.jpg`.
- The requirements page displays the examples as equal-size cards so good and bad examples can be compared directly without layout mismatch.
- The legacy combined files may remain in the repository for reference, but the current page should use the individual image cards.

## Validation Button Scope

The in-page validator should return a clear PASS or FAIL for technical checks we can make locally:

- 600 x 600 output from the camera/upload crop
- JPEG output
- Target file size at or below 200 KB for our workflow
- Basic light/plain background estimate from sample regions near the image edges

The validator must still tell users that staff review is required for issues a simple browser check cannot reliably detect, including hats, glasses, facial expression, head tilt, background objects, shadows, blur, and exact head-size placement.
