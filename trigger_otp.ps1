$headers = @{
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdna2xiY2pvdW1qdHFmcHBkc2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTgxNTksImV4cCI6MjEwMjQzNDE1OX0.wobc0ZdBfZ1mQTlYhgih88AAHqqsk6XEqAsh8x7yCjg"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdna2xiY2pvdW1qdHFmcHBkc2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTgxNTksImV4cCI6MjEwMjQzNDE1OX0.wobc0ZdBfZ1mQTlYhgih88AAHqqsk6XEqAsh8x7yCjg"
    "Content-Type" = "application/json"
}
$body = @{
    email = "technik22422@gmail.com"
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "https://ggklbcjoumjtqfppdsfu.supabase.co/auth/v1/otp" -Method Post -Headers $headers -Body $body
    Write-Host "SUCCESS: OTP Email Sent to technik22422@gmail.com"
    Write-Host ($res | ConvertTo-Json)
} catch {
    Write-Host "Notice:" $_.Exception.Message
}
