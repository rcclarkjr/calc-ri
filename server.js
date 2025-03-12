require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();

// Allow larger image sizes (50MB)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Configure CORS to accept requests from all your sites
app.use(cors({
  origin: [
    'https://robert-clark-4dee.mykajabi.com', 
    'http://localhost:5000', 
    'https://ri-backend-bozm.onrender.com',
    'https://advisory.valoraanalytics.com'  // Add this new origin
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add a fallback CORS handler for any missed routes
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Serve static files from the "public" folder (for serving prompts and images)
app.use(express.static("public"));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Endpoint to serve the RI calculation prompt
app.get("/PromptCalcRI.txt", (req, res) => {
  // If the file exists, serve it, otherwise send the default prompt
  const promptPath = path.join(__dirname, "public", "PromptCalcRI.txt");
  
  if (fs.existsSync(promptPath)) {
    res.sendFile(promptPath);
  } else {
    // Provide a default RI calculation prompt
    res.type("text").send(getDefaultPrompt());
  }
});

// Function to get default prompt
function getDefaultPrompt() {
  return `Prompt for Representational Index (RI)

Variables:
[artist name] = The artist name will be provided
[title] = The title will be provided

Instructions:
Evaluate the attached artwork and calculate the Representational Index (RI) based on the provided definitions. Use the scoring methodology detailed below to ensure consistency in evaluation. Provide your final RI score rounded to one decimal place of precision.
________________________________________
Definitions of the 5 Categories Comprising the RI (Scale of 1 to 5):
1.	Pure Abstract (Non-Representational):
o	Definition: Art that does not depict recognizable objects or subjects. It focuses entirely on form, color, texture, and composition without a reference to the observable world.
o	Examples: Wassily Kandinsky, Piet Mondrian, Mark Rothko.
o	Numerical Value: 1
2.	Abstract Expressionism (Suggestive Abstraction):
o	Definition: Art that begins to hint at real-world forms or emotions but remains highly abstract. There may be dynamic gestures or loosely suggestive shapes, but interpretation is left to the viewer.
o	Examples: Jackson Pollock's drip paintings, Willem de Kooning's abstracted figures.
o	Numerical Value: 2
3.	Semi-Abstraction (Stylized Representation):
o	Definition: Art where recognizable forms or subjects are present but are heavily stylized, simplified, or abstracted. There's a clear reference to reality, but it's transformed into something more symbolic or decorative.
o	Examples: Cubism (e.g., Pablo Picasso's Les Demoiselles d'Avignon), Henri Matisse's The Red Studio.
o	Numerical Value: 3
4.	Representational with Artistic Interpretation (Stylized Realism, Abstract Realism):
o	Definition: Art depicting real-world subjects with noticeable artistic intervention, stylization, or emotive exaggeration. Realistic elements deviate for expressive or conceptual purposes.
o	Examples: Impressionism (e.g., Claude Monet's Water Lilies), Surrealism (e.g., Salvador Dalí's The Persistence of Memory).
o	Numerical Value: 4
5.	Photo-Realism (Hyper-Realistic Representation):
o	Definition: Art that mimics the appearance of a photograph, achieving an almost indistinguishable resemblance to reality through meticulous detail and accuracy.
o	Examples: Chuck Close, Richard Estes, Audrey Flack.
o	Numerical Value: 5
________________________________________
Scoring Methodology for Consistency:
1.	Primary Category Identification:
o	Begin by identifying the primary category that most closely aligns with the artwork's characteristics. Assign this as the base category score.
2.	Secondary Category Consideration (if applicable):
o	If the artwork contains significant traits of another category, assign a secondary score. Use this score to reflect the secondary influence, but weight it proportionally based on how dominant the traits are in the artwork.
3.	Averaging and Weighting Instructions:
o	If only one category applies, the RI is equal to the category's numerical value.
o	If two categories apply:
	Assign weights based on visual dominance. (For example, 70% for the dominant category and 30% for the secondary category.)
	Compute the weighted average as:
RI = (Primary Score × Primary Weight) + (Secondary Score × Secondary Weight)
o	Always round the final RI to one decimal place.
4.	Consistency Across Runs:
o	Use the same structured methodology and evaluation framework in all subsequent analyses to ensure consistent results.
________________________________________
Output Format:
1. Calculate the Representational Index (RI) value for the artwork.
2. Return ONLY the following in your response:
   - The RI value: "Representational Index (RI) = n.n" with n.n being the value rounded to one decimal
   - One or two sentences that explain why the artwork is deemed to be at that RI value level.
   
Do not include any additional analysis, commentary, or descriptions beyond what is requested.`;
}

app.post("/analyze", async (req, res) => {
  try {
    console.log("Received analyze request");
    const { prompt, image, artTitle, artistName } = req.body;

    if (!prompt) {
      console.log("Missing prompt in request");
      return res.status(400).json({ error: { message: "Prompt is required" } });
    }
    
    if (!image) {
      console.log("Missing image in request");
      return res.status(400).json({ error: { message: "Image is required" } });
    }

    if (!OPENAI_API_KEY) {
      console.log("Missing OpenAI API key");
      return res.status(500).json({ error: { message: "Server configuration error: Missing API key" } });
    }

    // Log info about the request (without the full image data for brevity)
    console.log(`Processing request for artwork: "${artTitle}" by ${artistName}`);
    console.log(`Prompt length: ${prompt.length} characters`);
    
    // Construct the prompt with art title and artist name
    const finalPrompt = `Title: "${artTitle}"
Artist: "${artistName}"

${prompt}`;

    console.log("Sending request to OpenAI API");
    
    // Send request to OpenAI API
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4-turbo",
        messages: [
          { 
            role: "system", 
            content: "You are an expert art critic specializing in analyzing the representational nature of artwork. Your task is to evaluate the representational characteristics of the provided artwork and calculate an accurate RI (Representational Index) value between 1.00 and 5.00. Provide only the RI value and a 2-3 sentence explanation - no additional commentary or analysis." 
          },
          { 
            role: "user", 
            content: [
              { type: "text", text: finalPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }
            ]
          }
        ],
        max_tokens: 600 // Reduced as we need less text in the response
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    console.log("Received response from OpenAI API");
    
    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      console.log("Invalid response format from OpenAI:", JSON.stringify(response.data));
      return res.status(500).json({ error: { message: "Invalid response from OpenAI API" } });
    }

    let analysisText = response.data.choices[0].message.content;
    console.log("Analysis text:", analysisText);

    // Extract the RI value using regex
    const riRegex = /Representational\s+Index\s*\(?RI\)?\s*=\s*(\d+\.\d+)/i;
    const riMatch = analysisText.match(riRegex);
    let riValue = "3.00"; // Default value if extraction fails
    
    if (riMatch && riMatch[1]) {
      riValue = riMatch[1];
      // Ensure it's formatted to 2 decimal places
      if (riValue.split('.')[1].length === 1) {
        riValue = `${riValue}0`;
      }
      console.log("Extracted RI value:", riValue);
    } else {
      console.log("Could not extract RI value from response");
    }
    
    // Extract the explanation text (everything after the RI value statement)
    const explanationRegex = /Representational\s+Index\s*\(?RI\)?\s*=\s*\d+\.\d+\s*(.+?)(?:\n\n|\n$|$)/i;
    const explanationMatch = analysisText.match(explanationRegex);
    let explanation = "";
    
    if (explanationMatch && explanationMatch[1]) {
      explanation = explanationMatch[1].trim();
      console.log("Extracted explanation:", explanation);
    } else {
      console.log("Could not extract explanation from response");
    }

    const finalResponse = {
      analysis: analysisText,
      ri: riValue,
      explanation: explanation
    };

    console.log("Sending final response to client");
    // Send the response
    res.json(finalResponse);

  } catch (error) {
    console.error("Error in /analyze endpoint:", error);
    
    // Detailed error logging
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response headers:", error.response.headers);
      console.error("Response data:", JSON.stringify(error.response.data));
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    
    const errorMessage = error.response?.data?.error?.message || 
                         error.message || 
                         "An unknown error occurred";
                         
    res.status(500).json({ 
      error: { 
        message: errorMessage,
        details: error.toString()
      } 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));