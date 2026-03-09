# Marketplace Image Specifications (2026)

**Updated**: January 22, 2026
**Status**: Current requirements for all 6 supported marketplaces
**Purpose**: Define exact output dimensions for WF-18 through WF-23 marketplace optimization workflows

---

## Executive Summary

Each marketplace has specific image requirements for optimal display and search ranking. SwiftList will automatically generate marketplace-specific outputs at the correct dimensions, aspect ratios, and file sizes.

---

## 1. eBay

**Workflow ID**: WF-25 (eBay Formatter)

### Requirements
- **Minimum**: 500 x 500 pixels
- **Recommended**: **1600 x 1600 pixels** (enables zoom, best display)
- **Maximum**: 9000 x 9000 pixels
- **Aspect Ratio**: 1:1 (square)
- **File Size**: Max 12MB
- **Format**: JPEG (quality 90+), PNG, GIF, TIFF, BMP
- **Background**: White preferred for main image
- **Max Images**: 24 per listing (24 per variation)

### SwiftList Output
- **Dimension**: 1600 x 1600 pixels
- **Aspect Ratio**: 1:1
- **Format**: JPEG (quality 95)
- **Background**: White (#FFFFFF)
- **Cost**: $0.00 (local GraphicsMagick processing)

### Sources
- [Editing Product Photos for eBay in 2026 | Claid.ai](https://claid.ai/blog/article/editing-product-photos-for-e-bay/)
- [eBay Image Requirements: Best Practices & Size Guide](https://www.linnworks.com/blog/ebay-images-how-to/)
- [The best eBay image dimensions - Img handbook](https://www.img.vision/handbook/ebay/tips/image-dimensions/)

---

## 2. Etsy

**Workflow ID**: WF-26 (Etsy Formatter)

### Requirements
- **Minimum**: 635 x 635 pixels (to avoid search ranking penalties)
- **Recommended**: **2000 x 2000 pixels** (shortest side min 2000px)
- **Optimal**: 3000 x 2250 pixels (4:3 landscape) or 3000 x 3000 pixels (square)
- **Aspect Ratio**:
  - 1:1 (square) for thumbnails
  - 4:3 (landscape) for listings to prevent cropping
- **Resolution**: 72 PPI
- **File Size**: Max 1MB (keep below for fast loading)
- **Format**: JPEG, PNG
- **Max Images**: 10 per listing

### SwiftList Output
- **Dimension**: 2000 x 2000 pixels (square for versatility)
- **Aspect Ratio**: 1:1
- **Format**: JPEG (quality 85, optimized for <1MB)
- **Resolution**: 72 PPI
- **Cost**: $0.00 (local Sharp processing)

### Sources
- [Etsy Listing photo size Guide (Updated for 2026) - Outfy](https://www.outfy.com/blog/etsy-listing-photo-size-guide/)
- [Requirements and Best Practices for Images - Etsy Help](https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop)
- [Etsy Listing Photo Size Guide (2026) - Growing Your Craft](https://www.growingyourcraft.com/blog/etsy-listing-photo-optimal-size-aspect-ratio)

---

## 3. Amazon

**Workflow ID**: WF-27 (Amazon Formatter)

### Requirements
- **Minimum**: 500 x 500 pixels (absolute minimum)
- **Zoom Threshold**: 1000 x 1000 pixels (enables zoom feature)
- **Recommended**: **2000 x 2000 pixels** (best display quality)
- **Optimal**: 3000 x 3000 pixels (high-resolution displays)
- **Maximum**: 10000 x 10000 pixels
- **Aspect Ratio**: 1:1 (square) most common
- **File Size**: Max 10MB
- **Format**: JPEG (preferred), TIFF, PNG, GIF
- **Product Coverage**: Must fill at least 85% of frame
- **Background**: Pure white (#FFFFFF RGB 255, 255, 255) for main image

### SwiftList Output
- **Dimension**: 2000 x 2000 pixels (enables zoom, fast loading)
- **Aspect Ratio**: 1:1
- **Format**: JPEG (quality 95)
- **Background**: Pure white (#FFFFFF)
- **Product Coverage**: 85-90% of frame
- **Cost**: $0.00 (local GraphicsMagick processing)

### Sources
- [Amazon Product Images Size and Best Practices 2026](https://www.wakecommerce.co.uk/blog/amazon-product-images-size-and-best-practices-2026)
- [Amazon Image Requirements 2024 - Seller Sprite](https://www.sellersprite.com/en/blog/amazon-image-requirements)
- [Complete Guide to Amazon Image Requirements in 2025 - soona](https://soona.co/image-resizer/amazon-image-size-specs)

---

## 4. Poshmark

**Workflow ID**: WF-28 (Poshmark Formatter)

### Requirements
- **Minimum**: 500 x 500 pixels (absolute minimum)
- **Recommended**: **1600 x 1600 pixels** (best display)
- **Common Size**: 1080 x 1080 pixels (Instagram-style)
- **Maximum**: 10000 x 10000 pixels
- **Aspect Ratio**:
  - **Legacy**: 1:1 (square)
  - **NEW (2025-2026)**: Portrait aspect ratio rolling out
- **Format**: JPEG, PNG
- **Max Images**: 16 per listing

### SwiftList Output
- **Dimension**: 1600 x 1600 pixels (square format for compatibility)
- **Aspect Ratio**: 1:1 (monitoring portrait format rollout)
- **Format**: JPEG (quality 90)
- **Cost**: $0.00 (local Sharp processing)

### Notes
Poshmark announced a shift from square to portrait aspect ratio in late 2025. SwiftList will continue outputting square until portrait format is fully rolled out across the platform.

### Sources
- [What is the best size for your photos? | Photoroom Help Center](https://help.photoroom.com/en/articles/3672112-what-is-the-best-size-for-your-photos)
- [How to Take Square Photos for Poshmark - Pixelcut](https://www.pixelcut.ai/learn/how-to-take-square-photos-for-poshmark)
- [Poshmark Photo Aspect Ratio Updates - Value Added Resource](https://www.valueaddedresource.net/poshmark-photo-aspect-ratio-item-condition-updates/)

---

## 5. Mercari

**Workflow ID**: WF-29 (Mercari Formatter)

### Requirements
- **Minimum**: Not officially specified
- **Recommended**: **1600 x 1600 pixels** (crosslisting best practice)
- **Aspect Ratio**: 1:1 (square)
- **Format**: JPEG, PNG
- **Max Images**: 12 per listing
- **Note**: Use highest resolution setting on your device

### SwiftList Output
- **Dimension**: 1600 x 1600 pixels
- **Aspect Ratio**: 1:1
- **Format**: JPEG (quality 90)
- **Cost**: $0.00 (local Sharp processing)

### Notes
Mercari doesn't publish specific technical requirements, but 1600px square images are the reseller community standard for optimal crosslisting quality.

### Sources
- [Creating a Listing | Mercari Help](https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/)
- [How to take great photos | Mercari Help](https://www.mercari.com/us/help_center/article/240/)
- [Photo Tips for Resellers - List Perfectly](https://listperfectly.com/tips/best-image-sources-for-importing-listings/)

---

## 6. Depop

**Workflow ID**: WF-30 (Depop Formatter)

### Requirements
- **Minimum**: 1080 x 1080 pixels
- **Recommended**: **1280 x 1280 pixels** (best quality)
- **Aspect Ratio**: 1:1 (square) **REQUIRED**
- **Format**: JPEG, PNG
- **Max Images**: 4 per listing
- **CRITICAL**: Stock photos prohibited - must be original photos of your item
- **Auto-cropping**: Non-square images are automatically cropped

### SwiftList Output
- **Dimension**: 1280 x 1280 pixels
- **Aspect Ratio**: 1:1 (exact square required)
- **Format**: JPEG (quality 90)
- **Cost**: $0.00 (local Sharp processing)

### Sources
- [How to take great photos for Depop | Photoroom](https://help.photoroom.com/en/articles/4898963-how-to-take-great-photos-for-depop)
- [Guide to Depop's Photo Guidelines - Reeva.ai](https://blog.reeva.ai/resources/a-guide-to-depop-s-photo-and-video-guidelines/)
- [What is the best size for your photos? | Photoroom](https://help.photoroom.com/en/articles/3672112-what-is-the-best-size-for-your-photos)

---

## Summary Table

| Marketplace | Recommended Size | Aspect Ratio | Max File Size | Max Images | Background |
|-------------|-----------------|--------------|---------------|------------|------------|
| **eBay** | 1600 x 1600px | 1:1 | 12MB | 24 | White preferred |
| **Etsy** | 2000 x 2000px | 1:1 or 4:3 | 1MB | 10 | Any |
| **Amazon** | 2000 x 2000px | 1:1 | 10MB | 9 | Pure white main |
| **Poshmark** | 1600 x 1600px | 1:1 | N/A | 16 | Any |
| **Mercari** | 1600 x 1600px | 1:1 | N/A | 12 | Any |
| **Depop** | 1280 x 1280px | 1:1 (strict) | N/A | 4 | Any |

---

## Implementation in SwiftList

### Workflow Architecture

Each marketplace formatter (WF-25 through WF-30) will:

1. **Input**: User's processed product image (from background removal, upscale, etc.)
2. **Process**:
   - Resize to marketplace-specific dimensions
   - Apply aspect ratio (crop/pad as needed)
   - Optimize file size
   - Add white background if required (eBay, Amazon)
   - Ensure product fills 85-90% of frame
3. **Output**: Marketplace-ready image stored in Supabase Storage
4. **Cost**: $0.00 (local processing via Sharp/GraphicsMagick)

### Technology Stack

- **Sharp** (Node.js): Primary image processing library
- **GraphicsMagick**: Backup for complex operations
- **Local Processing**: All marketplace formatters run locally (no API calls = $0 cost)
- **BullMQ Queue**: `marketplace-formatter` queue handles all 6 workflows

### Quality Assurance

Each output is validated against:
- ✅ Correct dimensions
- ✅ Correct aspect ratio
- ✅ File size under marketplace limit
- ✅ Format compatibility
- ✅ Background color (if applicable)
- ✅ Product coverage percentage

---

## Future Considerations

### Monitoring Required

1. **Poshmark Portrait Format**: Currently rolling out, may need to update from square to portrait
2. **Marketplace Policy Changes**: Image requirements can change quarterly
3. **New Marketplaces**: Add Shopify, BigCommerce, WooCommerce if user demand exists

### Potential Optimizations

1. **Smart Cropping**: Use AI to detect product bounds and optimize framing per marketplace
2. **Multi-variant Output**: Generate all 6 marketplace versions in parallel
3. **SEO Optimization**: Embed marketplace-specific metadata in EXIF data

---

## API Integration (if needed)

All marketplace formatters use **local processing** (Sharp/GraphicsMagick), but if we need AI-powered smart cropping:

- **Gemini 2.0 Flash Vision**: Detect product bounds ($0.001/image)
- **Claude Sonnet 3.5 Vision**: Analyze optimal framing ($0.0015/image)

---

## Cost Analysis

| Marketplace | Processing Cost | API Cost | Total Cost |
|-------------|----------------|----------|------------|
| eBay | $0.00 (local) | $0.00 | **$0.00** |
| Etsy | $0.00 (local) | $0.00 | **$0.00** |
| Amazon | $0.00 (local) | $0.00 | **$0.00** |
| Poshmark | $0.00 (local) | $0.00 | **$0.00** |
| Mercari | $0.00 (local) | $0.00 | **$0.00** |
| Depop | $0.00 (local) | $0.00 | **$0.00** |

**Total cost for all 6 marketplace outputs: $0.00**

This is a **massive competitive advantage** - most competitors charge per marketplace export.

---

## Testing Checklist

Before deploying marketplace formatters:

- [ ] Test eBay output (1600x1600, white background)
- [ ] Test Etsy output (2000x2000, <1MB file size)
- [ ] Test Amazon output (2000x2000, pure white background, 85% product coverage)
- [ ] Test Poshmark output (1600x1600, square)
- [ ] Test Mercari output (1600x1600, square)
- [ ] Test Depop output (1280x1280, exact square)
- [ ] Verify all file sizes under limits
- [ ] Verify all formats are JPEG quality 90+
- [ ] Test batch processing (1 image → 6 marketplace versions)

---

**Document Status**: ✅ Complete - Ready for implementation
**Last Updated**: January 22, 2026
**Next Review**: Quarterly (or when marketplace policies change)
