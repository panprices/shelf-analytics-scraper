echo "Making POST request..."
echo ""
curl -X POST "localhost:8080/exploreCategory"  -H "Content-Type: application/json"  -d '{"url": "https://www.venturedesign.se/utemobler/dynor"}' -i
