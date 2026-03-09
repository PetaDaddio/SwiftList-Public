

# Fabric Intelligence API Documentation

**Version**: 1.0.0
**Base URL**: `https://api.swiftlist.com`
**Status**: MVP Implementation

## Overview

The Fabric Intelligence API analyzes fashion/fabric product images to detect material type, physical properties, and provides optimized rendering hints for AI image generation. The system continuously learns from user feedback to improve accuracy over time.

## Key Features

✅ **Fabric Type Detection** - Identifies 20+ fabric types (cotton, silk, denim, leather, etc.)
✅ **Physics-Informed Analysis** - Analyzes drape, weight, sheen, and texture characteristics
✅ **Intelligent Routing** - Recommends budget vs. premium rendering path based on fabric complexity
✅ **Learning System** - Improves accuracy through user feedback loop
✅ **API-First Design** - RESTful endpoints for internal and external use

---

## Authentication

### Internal Use (SwiftList App)
Uses Supabase authentication (Bearer token from user session).

### External Use (API Partners)
Requires API key authentication:
```http
Authorization: Bearer YOUR_API_KEY
```

**Rate Limits**:
- Free tier: 100 requests/hour
- Pro tier: 1,000 requests/hour
- Enterprise: Unlimited

---

## Endpoints

### 1. Analyze Fabric

Analyzes a product image to detect fabric type and characteristics.

**Endpoint**: `POST /api/fabric/analyze`

**Request Body**:
```json
{
  "imageUrl": "https://example.com/product.jpg",
  "userHints": {
    "category": "apparel",
    "knownFabric": "denim",
    "quality": "standard"
  },
  "jobId": "optional-job-id-for-tracking"
}
```

**Alternative (Base64 Upload)**:
```json
{
  "imageBase64": "/9j/4AAQSkZJRgABAQEAYABgAAD...",
  "userHints": {
    "category": "apparel"
  }
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `imageUrl` | string (URL) | Either this or `imageBase64` | Public URL of product image |
| `imageBase64` | string (base64) | Either this or `imageUrl` | Base64-encoded image data |
| `userHints.category` | enum | Optional | Product category: `apparel`, `accessories`, `footwear`, `home-textiles` |
| `userHints.knownFabric` | string | Optional | User's guess of fabric type (helps improve accuracy) |
| `userHints.quality` | enum | Optional | Desired quality level: `budget`, `standard`, `premium` |
| `jobId` | string | Optional | Internal job ID for tracking (SwiftList internal use) |

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "fabricType": "denim",
    "confidence": 0.95,
    "characteristics": {
      "weight": "medium",
      "drape": "structured",
      "stretch": "slight",
      "sheen": "matte",
      "texture": "diagonal twill weave, visible texture",
      "pattern": "solid",
      "transparency": "opaque",
      "complexity": "simple",
      "specialFeatures": []
    },
    "renderingHints": {
      "foldStyle": "angular creases",
      "shadowDepth": "moderate",
      "surfaceDetail": "diagonal twill weave",
      "lightingStyle": "diffused soft lighting",
      "requiresPhysicsSimulation": false,
      "requiresHighResolution": false,
      "requiresMultiAngle": false,
      "generatedPrompt": "Professional product photography, structured denim fabric, diagonal twill weave, angular folds and creases, clean white background, studio lighting, high detail, commercial quality"
    },
    "recommendedModel": "budget",
    "routingReason": "denim works well with budget model (92% success rate)",
    "estimatedCost": 0.005,
    "analysisId": "fa_1738617600_abc123xyz",
    "promptVersion": "v1.0.0",
    "modelVersion": "gemini-2.0-flash-exp",
    "timestamp": "2026-02-03T18:30:00.000Z"
  },
  "meta": {
    "durationMs": 1240,
    "apiVersion": "1.0.0",
    "creditsUsed": 1
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `fabricType` | string | Detected fabric type (e.g., "denim", "silk", "cotton") |
| `confidence` | number | Detection confidence (0.0 - 1.0) |
| `characteristics` | object | Physical properties of the fabric |
| `renderingHints` | object | AI prompt engineering hints for image generation |
| `recommendedModel` | enum | Routing recommendation: `budget` or `premium` |
| `routingReason` | string | Explanation for routing decision |
| `estimatedCost` | number | Estimated cost in USD for image generation |
| `analysisId` | string | Unique ID for feedback tracking |
| `generatedPrompt` | string | Ready-to-use prompt for Imagen 3 or RunwayML |

**Error Responses**:

```json
// 400 Bad Request - Invalid input
{
  "success": false,
  "error": {
    "message": "Either imageUrl or imageBase64 is required",
    "code": "FABRIC_IMAGE_REQUIRED"
  }
}

// 401 Unauthorized - Missing authentication
{
  "success": false,
  "error": {
    "message": "Unauthorized - API key or authentication required",
    "code": "FABRIC_AUTH_REQUIRED"
  }
}

// 500 Internal Server Error
{
  "success": false,
  "error": {
    "message": "Internal server error",
    "code": "FABRIC_INTERNAL_ERROR"
  }
}
```

---

### 2. Submit Feedback

Provides feedback on fabric analysis quality to improve the learning system.

**Endpoint**: `POST /api/fabric/feedback`

**Request Body**:
```json
{
  "analysisId": "fa_1738617600_abc123xyz",
  "jobId": "optional-job-id",
  "rating": 5,
  "fabricTypeCorrect": true,
  "outputQuality": "excellent",
  "comments": "Perfect fabric detection!"
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `analysisId` | string | **Required** | Analysis ID from `/analyze` response |
| `jobId` | string | Optional | Job ID for tracking |
| `rating` | integer | **Required** | Overall satisfaction (1-5 stars) |
| `fabricTypeCorrect` | boolean | **Required** | Was fabric type detected correctly? |
| `outputQuality` | enum | **Required** | Generated image quality: `poor`, `fair`, `good`, `excellent` |
| `correctFabricType` | string | Optional | If wrong, what should it be? |
| `comments` | string | Optional | Additional notes (max 500 chars) |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Thank you for your feedback! This helps us improve.",
  "data": {
    "feedbackId": "fb_1738617700_xyz987def",
    "creditsAwarded": 1
  }
}
```

**Benefits of Submitting Feedback**:
- ✅ Earn 1 credit per feedback submission
- ✅ Help improve fabric detection accuracy
- ✅ Contribute to better routing decisions
- ✅ Shape future fabric support

---

## Fabric Types Supported

| Fabric Type | Budget Model Success | Premium Model Success | Recommended Path |
|-------------|---------------------|----------------------|------------------|
| **Cotton** | 95% | 97% | Budget |
| **Denim** | 92% | 94% | Budget |
| **Linen** | 93% | 95% | Budget |
| **Wool** | 90% | 93% | Budget |
| **Canvas** | 91% | 93% | Budget |
| **Polyester** | 85% | 88% | Budget |
| **Silk** | 78% | 88% | Premium |
| **Satin** | 76% | 85% | Premium |
| **Chiffon** | 72% | 82% | Premium |
| **Leather** | 80% | 85% | Premium |
| **Suede** | 78% | 83% | Premium |
| **Velvet** | 82% | 87% | Premium |
| **Lace** | 70% | 80% | Premium |

**Note**: Success rates are continuously updated based on user feedback.

---

## Usage Examples

### Example 1: Basic Fabric Analysis (JavaScript/TypeScript)

```typescript
async function analyzeFabric(imageUrl: string) {
  const response = await fetch('https://api.swiftlist.com/api/fabric/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YOUR_API_KEY}`
    },
    body: JSON.stringify({
      imageUrl,
      userHints: {
        category: 'apparel',
        quality: 'standard'
      }
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log(`Fabric: ${result.data.fabricType}`);
    console.log(`Confidence: ${(result.data.confidence * 100).toFixed(1)}%`);
    console.log(`Recommended: ${result.data.recommendedModel}`);
    console.log(`Cost: $${result.data.estimatedCost}`);

    // Use the generated prompt for image generation
    return result.data.renderingHints.generatedPrompt;
  } else {
    throw new Error(result.error.message);
  }
}
```

### Example 2: Analyze with Base64 Upload (Python)

```python
import requests
import base64

def analyze_fabric_base64(image_path):
    # Read and encode image
    with open(image_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode('utf-8')

    # Call API
    response = requests.post(
        'https://api.swiftlist.com/api/fabric/analyze',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {YOUR_API_KEY}'
        },
        json={
            'imageBase64': image_data,
            'userHints': {
                'category': 'apparel'
            }
        }
    )

    result = response.json()
    return result['data']
```

### Example 3: Submit Feedback (cURL)

```bash
curl -X POST https://api.swiftlist.com/api/fabric/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "analysisId": "fa_1738617600_abc123xyz",
    "rating": 5,
    "fabricTypeCorrect": true,
    "outputQuality": "excellent",
    "comments": "Perfect detection!"
  }'
```

---

## Learning System Architecture

```
┌─────────────────────────────────────────────────────┐
│  USER UPLOADS IMAGE                                 │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  FABRIC INTELLIGENCE API                            │
│  ├─ Gemini 2.5 Flash (Vision Analysis)             │
│  ├─ Fabric Knowledge Base (20+ types)              │
│  └─ Intelligent Routing (Budget vs Premium)        │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  IMAGE GENERATION                                   │
│  ├─ Budget Path: Google Imagen 3 ($0.004)          │
│  └─ Premium Path: RunwayML Act-Two ($0.12)         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  USER RATES OUTPUT                                  │
│  ├─ Fabric type correct?                           │
│  ├─ Output quality rating (1-5 stars)              │
│  └─ Optional comments                              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  LEARNING SYSTEM UPDATES                            │
│  ├─ Update success rates per fabric type           │
│  ├─ Refine routing decisions                       │
│  ├─ Improve prompt templates                       │
│  └─ Award 1 credit to user for feedback            │
└─────────────────────────────────────────────────────┘
```

---

## Cost Comparison

| Path | Fabric Types | Cost | Quality | Use Case |
|------|--------------|------|---------|----------|
| **Budget** | Cotton, denim, wool, linen, canvas | $0.005 | Good | Standard e-commerce, high volume |
| **Premium** | Silk, velvet, leather, chiffon, lace | $0.121 | Excellent | Luxury fashion, complex draping |

**Average Cost**: $0.028/analysis (77% savings vs. always using premium)

---

## Rate Limiting

- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour
- **Enterprise**: Unlimited

Rate limit headers included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1738621200
```

---

## Support

- **Documentation**: https://docs.swiftlist.com/fabric-api
- **Status Page**: https://status.swiftlist.com
- **Support Email**: api-support@swiftlist.com
- **Discord**: https://discord.gg/swiftlist

---

## Changelog

### Version 1.0.0 (Feb 3, 2026)
- ✅ Initial MVP release
- ✅ 20+ fabric types supported
- ✅ Intelligent routing (budget vs premium)
- ✅ Learning system with feedback loop
- ✅ RESTful API endpoints

### Roadmap
- 🔜 Multi-angle generation support
- 🔜 Fabric texture enhancement pass
- 🔜 Real-time webhook notifications
- 🔜 Batch processing endpoint
- 🔜 WebSocket streaming for live analysis

---

**Built with ❤️ by the SwiftList Team**
