$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdna2xiY2pvdW1qdHFmcHBkc2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTgxNTksImV4cCI6MjEwMjQzNDE1OX0.wobc0ZdBfZ1mQTlYhgih88AAHqqsk6XEqAsh8x7yCjg"
    "Content-Type" = "application/json"
}
$body = @{
    email = "technik22422@gmail.com"
    token = "111111"
    type = "email"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "https://ggklbcjoumjtqfppdsfu.supabase.co/auth/v1/verify" -Method Post -Headers $headers -Body $body
    Write-Host "WRONG CODE PASSED UNEXPECTEDLY"
} catch {
    Write-Host "EXPECTED RESULT (WRONG CODE REJECTED):" $_.Exception.Message
}
