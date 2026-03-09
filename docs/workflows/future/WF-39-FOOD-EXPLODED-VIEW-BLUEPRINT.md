# WF-39: Food Exploded View - Exact Implementation Blueprint

**Status**: Ready to Build (Complete Blueprint Provided)
**Date**: January 5, 2026
**Source**: Creator's exact prompts from viral food ad

---

## Overview

This is the **EXACT implementation** for WF-39 Exploded View specifically optimized for **food products**. A creator went viral with steak salad ads and gave us their complete blueprint with prompts.

**What it does**: Bowl of food → smooth explosion → ingredients separate and float in exploded view → text labels typewriter in → final educational/marketing shot

**Perfect for**:
- Food brand advertising
- Nutrition education (calorie breakdowns)
- Recipe marketing
- Meal kit services
- Restaurant menu visualization

---

## The Exact 2-Step Process

### Step 1: Generate 2 Keyframe Images with Nano Banana Pro

**Image 1: Assembled Food (Normal State)**

```
Overhead, top-down food photography of a vibrant, healthy steak salad bowl on a light beige stone surface. A shallow ceramic bowl filled with finely chopped curly kale as the base. Medium-rare sliced steak arranged neatly across the center, pink interior with seared edges and visible seasoning. On one side, fanned avocado slices with cracked black pepper. Bright red diced bell peppers, crumbled white cheese (feta-style), and finely chopped greens distributed evenly around the bowl. A lemon wedge tucked against the edge of the bowl. A blue-handled fork resting inside the bowl, angled slightly toward the center. Natural soft daylight from above, minimal shadows, clean editorial food styling. Sharp focus, high detail, realistic textures, fresh and appetizing. Modern cookbook / Instagram food photography aesthetic. No hands, no text, no branding, no clutter.
```

**Image 2: Exploded View with Labels**

```
Using the original steak salad image as the sole ingredient reference, create a clean, vertically stacked exploded-view visualization of the same salad.

The ingredients are arranged in a strict bottom-to-top order, evenly spaced along a single centered vertical axis, with symmetry, alignment, and visual balance.

Bottom layer (base of the salad):
Finely chopped curly kale and mixed leafy greens, forming a soft, natural pile that anchors the composition.

Middle layers (core ingredients), stacked upward in this order:
– Diced red bell peppers and chopped greens, evenly distributed
– Crumbled white cheese (feta-style), centered and proportionally scaled
– Medium-rare sliced steak, laid flat and neatly fanned, pink interior visible
– Avocado slices, evenly cut and symmetrically fanned

Top layer (finishing elements):
Lemon wedge and light vinaigrette droplets, placed delicately at the top of the image to signal freshness and completion.

All ingredient layers are parallel, evenly spaced, and centered, with no rotation, tilt, or perspective distortion.

Ingredients appear to float gently while maintaining realistic proportions, textures, and color accuracy.

Add short, minimal annotations with thin leader lines.
Alternate caption placement from left to right as you move up the stack to create visual balance and avoid crowding.

Example annotations:
– Leafy greens: "Fresh base, rich in nutrients, approx. 20 cal"
– Steak: "High-quality protein, approx. 300 cal"
– Avocado: "Healthy fats, creamy balance, approx. 160 cal"
– Red pepper: "Natural sweetness & antioxidants, approx. 25 cal"
– Feta Cheese: "Tangy flavor & calcium, approx. 120 cal"
– Lemon & vinaigrette: "Light finish enhancing natural flavors, approx. 60 cal"

Background is pure white or very light neutral, matte and distraction-free.

Lighting is soft, even, and shadow-minimized with a clean editorial food-photography feel.

Style is premium food photography combined with a technical exploded diagram, suitable for marketing, nutrition education, or app UI.

No hands, no bowl, no clutter, no branding, no dramatic shadows.
```

---

### Step 2: Animate Transition with Kling 2.5 Turbo

**Kling Video Generation Prompt**:

```
A high-angle, cinematic studio shot of a fresh steak salad in a white ceramic bowl, centered on a clean white background. The salad is fully assembled: finely chopped curly kale and leafy greens, medium-rare sliced steak, avocado slices, diced red bell peppers, crumbled white cheese, and a lemon wedge.

After a brief moment of stillness, the salad bursts upward in a controlled, elegant explosion, with each ingredient separating cleanly and moving upward along a vertical axis. The motion is smooth, slow, and weightless—no chaos, no spinning—creating a precise, visually satisfying deconstruction.

The ingredients settle into a perfectly aligned exploded-view composition, hovering in mid-air in distinct horizontal layers, evenly spaced and centered:
– Leafy greens at the bottom
– Red bell peppers and crumbled cheese above
– Medium-rare sliced steak laid flat and neatly fanned
– Avocado slices symmetrically arranged
– Lemon wedge and light vinaigrette droplets at the top

Once the ingredients are fully separated and stable, minimal technical annotation lines and labels fade in, alternating left and right for balance. Text is clean, modern, and readable, connected with thin leader lines, never overlapping the ingredients.

Lighting is soft and diffuse, studio-style, with minimal shadows.
Motion is slow-motion and cinematic, emphasizing clarity and elegance.
Ultra-realistic food textures, high detail, premium editorial aesthetic.
Camera remains locked and steady throughout.

No hands, no people, no clutter, no branding, no background movement.
End on the fully exploded, clearly labeled ingredient view.
```

**Kling Parameters**:
- **Start Image**: Image 1 (assembled salad)
- **End Image**: Image 2 (exploded view with labels)
- **Duration**: 6-8 seconds
- **Mode**: Professional
- **Motion Strength**: 0.8 (controlled explosion)
- **FPS**: 60 (smooth slow-motion)

---

## SwiftList Implementation

### Input Form

```typescript
interface FoodExplodedViewInput {
  foodType: 'salad' | 'burger' | 'bowl' | 'sandwich' | 'pizza' | 'dessert' | 'custom';
  ingredients: string[]; // ["kale", "steak", "avocado", "peppers", "feta", "lemon"]
  nutritionLabels: boolean; // Include calorie counts?
  labelStyle: 'minimal' | 'detailed' | 'nutritionist';
  brandColor?: string; // Optional brand color for labels
  videoLength: 6 | 8 | 10; // seconds
}
```

### Automated Ingredient Detection

```typescript
// If user uploads existing food photo instead of generating from scratch
async function detectIngredientsInFoodPhoto(imageUrl: string) {
  const analysis = await gemini.analyzeImage(imageUrl, {
    prompt: `
      Analyze this food photo and identify all visible ingredients.
      For each ingredient, provide:
      1. Ingredient name
      2. Approximate calories per serving shown
      3. Key nutritional benefit (protein, healthy fats, vitamins, etc.)
      4. Position in dish (bottom/middle/top, left/center/right)

      Format as JSON array sorted by vertical position (bottom to top).
    `
  });

  return analysis.ingredients;
}

// Example output:
[
  {
    name: "Curly kale",
    calories: 20,
    benefit: "Fresh base, rich in nutrients",
    position: "bottom"
  },
  {
    name: "Diced red bell peppers",
    calories: 25,
    benefit: "Natural sweetness & antioxidants",
    position: "middle_lower"
  },
  // ... more ingredients
]
```

### Label Generation with Calorie Data

```typescript
async function generateNutritionLabels(ingredients: string[]) {
  const labelPrompt = `
    For each of these food ingredients: ${ingredients.join(', ')}

    Generate marketing-style nutrition labels with:
    1. Key benefit (3-5 words, appetizing)
    2. Approximate calories
    3. Primary nutritional value (protein, healthy fats, vitamins, etc.)

    Format as JSON with style: concise, positive, educational.
  `;

  const labels = await gemini.generateContent(labelPrompt);

  return labels;
}

// Example output:
{
  "steak": {
    label: "High-quality protein",
    calories: 300,
    nutrition: "Complete protein, iron, B vitamins"
  },
  "avocado": {
    label: "Healthy fats, creamy balance",
    calories: 160,
    nutrition: "Monounsaturated fats, fiber, potassium"
  },
  // ... more
}
```

---

## Food Category Templates

### 1. Salad/Bowl
**Explosion Order**: Bottom → Top
- Base greens
- Grains (quinoa, rice)
- Protein (chicken, steak, tofu)
- Vegetables
- Toppings (cheese, nuts, seeds)
- Dressing/citrus

**Example**: Steak salad (blueprint provided), Buddha bowl, Poke bowl

---

### 2. Burger/Sandwich
**Explosion Order**: Bottom → Top
- Bottom bun
- Condiments (mayo, mustard)
- Lettuce/greens
- Tomato
- Protein (patty, chicken)
- Cheese
- Pickles/onions
- Top bun

**Example**: Cheeseburger, Chicken sandwich, BLT

---

### 3. Pizza
**Explosion Order**: Bottom → Top (Radial → Vertical)
- Crust
- Sauce
- Cheese layer
- Toppings (pepperoni, vegetables, etc.)
- Herbs/seasonings

**Example**: Pepperoni pizza, Margherita, Veggie supreme

---

### 4. Dessert
**Explosion Order**: Bottom → Top
- Base (cake, crust, cookie)
- Filling/cream layers
- Toppings (fruit, chocolate, nuts)
- Garnish (mint, powdered sugar)

**Example**: Layer cake, Cheesecake, Parfait

---

### 5. Breakfast Bowl
**Explosion Order**: Bottom → Top
- Base (oatmeal, yogurt, smoothie)
- Granola/nuts
- Fruit layers
- Seeds/toppings
- Honey/syrup drizzle

**Example**: Açai bowl, Oatmeal, Greek yogurt parfait

---

### 6. Pasta Dish
**Explosion Order**: Bottom → Top
- Pasta base
- Sauce
- Protein (meatballs, chicken, shrimp)
- Vegetables
- Cheese
- Herbs/garnish

**Example**: Spaghetti & meatballs, Pasta primavera, Carbonara

---

## Complete Workflow Specification

### WF-39-FOOD: Food Exploded View with Nutrition Labels

**Function**: Generate food exploded view animation with ingredient labels and calorie counts

**Input**:
- Food photo (uploaded) OR food type + ingredients (generated)
- Label style (minimal, detailed, nutritionist)
- Include nutrition info (yes/no)
- Video duration (6-10 seconds)

**Process**:

```typescript
async function generateFoodExplodedView(input: FoodExplodedViewInput) {
  let assembledImage, explodedImage;

  if (input.foodPhoto) {
    // User uploaded existing photo
    assembledImage = input.foodPhoto;

    // Detect ingredients automatically
    const ingredients = await detectIngredientsInFoodPhoto(input.foodPhoto);

    // Generate exploded view with detected ingredients
    explodedImage = await generateExplodedViewFromPhoto(
      input.foodPhoto,
      ingredients,
      input.labelStyle
    );
  } else {
    // Generate both images from scratch
    const ingredientList = input.ingredients.join(', ');

    // Generate assembled food photo
    assembledImage = await nanoBananaPro.generate({
      prompt: `Overhead, top-down food photography of ${input.foodType} with ${ingredientList}, ...`
    });

    // Generate exploded view
    explodedImage = await nanoBananaPro.generate({
      prompt: `Clean vertically stacked exploded-view of ${input.foodType}, ingredients: ${ingredientList}, ...`
    });
  }

  // Animate explosion with Kling AI
  const video = await kling.imageToVideo({
    startImage: assembledImage.url,
    endImage: explodedImage.url,
    duration: input.videoLength,
    mode: "professional",
    prompt: FOOD_EXPLOSION_PROMPT, // Blueprint prompt from creator
    motionStrength: 0.8,
    fps: 60
  });

  return video;
}
```

**Models Used**:

1. **Gemini Vision** (ingredient detection - optional)
   - Cost: $0.001

2. **Nano Banana Pro** (2 images: assembled + exploded)
   - Cost: $0.025 × 2 = $0.05

3. **Kling AI 2.5 Turbo** (explosion animation, 6-8 seconds)
   - Cost: $0.60

**Total Cost**: $0.651

**Pricing**: 100 credits ($5.00 revenue)

**Margin**: 87%

**Output**: MP4 video (1920×1080, 6-8 seconds, 60fps)

---

## Use Cases by Industry

### 1. Food Brands & CPG
**Example**: HelloFresh, Blue Apron, meal kit brands
**Use**: Show meal components with nutrition breakdown
**Value**: Transparency builds trust, highlights quality ingredients

### 2. Restaurants & Fast Food
**Example**: Chipotle, Sweetgreen, fast-casual chains
**Use**: Menu item visualization with calorie counts
**Value**: Helps customers make informed choices, increases perceived value

### 3. Nutrition Apps & Meal Planners
**Example**: MyFitnessPal, Noom, macro tracking apps
**Use**: Educational content showing balanced meals
**Value**: Visual learning tool for portion control and nutrition

### 4. Fitness Influencers & Coaches
**Example**: Personal trainers, dietitians, fitness YouTubers
**Use**: "What I eat in a day" content with nutrition breakdowns
**Value**: Educational + engaging, high shareability

### 5. Recipe Websites & Food Bloggers
**Example**: Tasty, Bon Appétit, food content creators
**Use**: Recipe visualization and ingredient showcases
**Value**: More engaging than static photos, increases recipe saves

### 6. Grocery & Meal Delivery
**Example**: Instacart, DoorDash, grocery brands
**Use**: Promote fresh ingredients and prepared meals
**Value**: Shows quality and freshness, drives purchases

---

## Marketing Positioning

**Tagline**: "Show what's inside. Build trust with transparency."

**Key Messages**:
- "685 calories of balanced nutrition"
- "See exactly what you're eating"
- "Transparency that sells"

**Social Proof**:
- Creator's video went viral on LinkedIn/Twitter
- Food brands already doing this manually (expensive)
- Nutrition-conscious consumers demand transparency

---

## Competitive Analysis

**What food brands do now**:
- ❌ Hire food photographers: $500-2,000/shoot
- ❌ Manual photo editing: 2-4 hours per image
- ❌ Hire motion graphics designer for animation: $1,500-3,000
- ❌ Total cost per exploded view ad: $2,000-5,000

**SwiftList with WF-39-FOOD**:
- ✅ $5.00 per exploded view animation (99.75% cheaper)
- ✅ 60-second generation time (vs 1-2 weeks)
- ✅ Automatic nutrition label generation
- ✅ Consistent quality, repeatable process
- ✅ No photographer, stylist, or editor needed

**Market Opportunity**:
- Every food brand needs this content
- Nutrition transparency is regulatory requirement in many markets
- Social media algorithm favors educational + engaging content
- Reusable for ads, social, website, packaging

---

## Success Metrics

### Quality Metrics
- Ingredient separation clarity: Target >95%
- Label readability: Target >98% (legible at 1080p)
- Explosion smoothness: Target >4.5/5.0 user rating
- Nutrition accuracy: Target 100% (verified against USDA database)

### Business Metrics
- Adoption rate: Target >20% of food-related users
- Viral coefficient: Target >1.5 (users share to colleagues)
- Repeat usage: Target >3 videos per user per month
- Brand logo add-on: Target >40% (premium feature)

### Viral Metrics
- LinkedIn shares: Target >30% (B2B food brands)
- Instagram saves: Target >25% (food bloggers/influencers)
- "Tutorial requests": Target >35% ask for process

---

## Premium Features (Upsells)

### 1. Brand Logo Overlay
**Feature**: Add brand logo to corner of video
**Pricing**: +10 credits
**Use**: White-label for food brands

### 2. Custom Color Labels
**Feature**: Match label colors to brand palette
**Pricing**: +5 credits
**Use**: Brand consistency

### 3. Multiple Variants
**Feature**: Generate 3 versions with different label styles (minimal, detailed, nutritionist)
**Pricing**: 250 credits (bundle discount)
**Use**: A/B testing for ads

### 4. Export to Social Formats
**Feature**: Auto-crop to square (1:1), vertical (9:16), horizontal (16:9)
**Pricing**: +15 credits
**Use**: One video → all social platforms

---

## Implementation Timeline

### Week 1: Core Food Explosion
- Integrate Nano Banana Pro API (already done)
- Integrate Kling AI API (already done)
- Implement exact blueprint prompts from creator
- Test with steak salad example

### Week 2: Ingredient Detection
- Integrate Gemini Vision for ingredient analysis
- Build nutrition database lookup (USDA API)
- Auto-generate calorie labels
- Test with 6 food categories

### Week 3: Template Library
- Create 6 food category templates (salad, burger, pizza, dessert, breakfast, pasta)
- Build ingredient position detection
- Optimize explosion order per category

### Week 4: Premium Features
- Brand logo overlay system
- Custom color labels
- Multi-format export
- Launch as premium feature (100 credits)

---

## Revenue Projections

**Assumptions**:
- 20% of users are food-related (restaurants, brands, bloggers, nutrition)
- Average 3 videos per user per month
- 40% add premium features

**Month 6 Projections** (1,000 active users):
```
200 food users
× 3 videos/month = 600 videos

Base videos: 600 × 0.6 = 360 @ 100 credits = 36,000 credits
Premium (logo/branding): 600 × 0.4 = 240 @ 115 credits = 27,600 credits
Total credits: 63,600 credits

Revenue: 63,600 × $0.05 = $3,180
COGS: 600 × $0.651 = $391
Net profit: $2,789/month

Margin: 87.7%
```

**12-Month Projection**:
- Month 6: $3,180 revenue, $2,789 profit
- Month 12: $7,950 revenue, $6,973 profit (assuming 50% MoM user growth)
- Cumulative Year 1 profit: ~$28,000

---

## Next Steps

1. ✅ **Blueprint Complete** - Creator gave us exact prompts
2. **Prototype This Week** - Build steak salad example using exact blueprint
3. **Test with Real Food Brands** - Reach out to 5 meal kit/nutrition brands for beta
4. **Launch as Premium Feature** - 100 credits, high margin, proven demand
5. **Add to Tier 1 Roadmap** - This should launch BEFORE WF-45/WF-46 due to complete blueprint + proven viral success

---

**Last Updated**: January 5, 2026
**Status**: READY TO BUILD - Complete implementation blueprint provided
**Priority**: TIER 1 - Launch in Month 3 (we have exact prompts + proven viral success)
**Recommended Launch Order**: 1. WF-39-FOOD (this), 2. WF-46 (cinematic), 3. WF-45 (interior design)
