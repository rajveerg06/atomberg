Write-Host "Setting up GoalTrack Portal..." -ForegroundColor Cyan

Write-Host "Installing Backend Dependencies..." -ForegroundColor Yellow
cd backend
npm install

Write-Host "Installing Frontend Dependencies..." -ForegroundColor Yellow
cd ../frontend
npm install

Write-Host "Starting GoalTrack Servers..." -ForegroundColor Green
Write-Host "Backend will run on http://localhost:5000" -ForegroundColor Gray
Write-Host "Frontend will run on http://localhost:5173" -ForegroundColor Gray

# Start backend in background
cd ../backend
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev"

# Start frontend in current window
cd ../frontend
npm run dev
