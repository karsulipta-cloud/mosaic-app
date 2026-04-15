NeedScope: Consumer Need-Gap Intelligence Dashboard

A data-driven decision support system built for the Mosaic Wellness Fellowship.

Project Overview: 
Instead of relying on intuition for New Product Development (NPD), NeedScope scrapes and analyzes 6,000 verified consumer reviews across 15 Indian D2C brands. By quantifying customer frustration, this dashboard identifies the exact product gaps where competitors are failing, providing the R&D team with a clear, data-backed roadmap for the next product launch.

Analytical Methodology: The Opportunity Score
To prevent raw complaint volume from skewing the data, this system utilizes a proprietary **Opportunity Score** algorithm. Not all unmet needs are equal; a highly validated, deeply frustrating issue is worth more than a frequent but mild complaint. 

The dashboard calculates the gap using the following weighted formula:
**Opportunity Score = (Frequency × W1) + (Validation × W2) + (Frustration × W3)**

* **Frequency (W1):** Total raw mentions of the unmet need.
* **Validation (W2):** The average number of "Helpful" upvotes from peer shoppers, proving market consensus.
* **Frustration (W3):** Calculated as `(5 - Average Rating)`. A 1-star review carries a significantly higher multiplier than a 4-star review, surfacing the deepest market pain points.

*Note: The dashboard features an interactive slider panel, allowing the R&D team to adjust these weights dynamically to stress-test the data.*

Key Findings & Recommendation
The data converges on a single, clear signal: Indian consumers are deeply frustrated by generic, one-size-fits-all formulations. The top-ranked unmet needs—such as **Skin Type Mismatch**, **Personalization Demand**, and **Combination Guidance**—all point to the same root cause. 

**Priority #1 Launch:** A Personalized Skin-Type Formulation System featuring an onboarding quiz, a progress-tracking journal to convert passive users to brand advocates, and in-app combination guidance.

Technical Implementation
* **Architecture:** Vanilla JavaScript, HTML5, CSS3.
* **Data Pipeline:** Asynchronous batched fetching via REST API (100 rows per request).
* **UI/UX:** Custom-built, responsive CSS grid architecture with dynamic data visualization, interactive heatmaps, and live-updating DOM elements.
* **Deployment:** Vercel (Continuous Integration via GitHub).

**About the Developer**
Developed by a final-year B.Com student bridging the gap between analytical frameworks and strategic marketing. With a background grounded in quantitative problem-solving and a track record of identifying high-growth business opportunities—including securing AIR 1 in the Startup Spotlight Challenge '25 and achieving 10 national-level awards in entrepreneurship and strategy—this project reflects a deep commitment to building scalable, data-driven Go-To-Market solutions.
