# Запускать, когда backend уже работает на localhost:8080
$base = 'http://localhost:8080/api'
Write-Host '1. Health' -ForegroundColor Cyan
Invoke-RestMethod "$base/health" | Format-List
Write-Host '2. Catalog (approved only)' -ForegroundColor Cyan
$catalog = Invoke-RestMethod "$base/recipes?size=30"
Write-Host "Published recipes: $($catalog.total)"
Write-Host '3. Moderation queue' -ForegroundColor Cyan
$adminHeaders = @{ 'X-Demo-User' = '3' }
$pending = Invoke-RestMethod "$base/recipes/pending" -Headers $adminHeaders
Write-Host "Pending recipes: $($pending.Count)"
Write-Host '4. Favorites of Anna' -ForegroundColor Cyan
$headers = @{ 'X-Demo-User' = '1' }
$favs = Invoke-RestMethod "$base/recipes/favorites" -Headers $headers
Write-Host "Favorites: $($favs.Count)"
Write-Host 'Smoke check complete.' -ForegroundColor Green
