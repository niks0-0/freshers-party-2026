$headers = @{
    "Content-Type" = "application/json"
}
$body = @{
    otp_length = 6
} | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/ggklbcjoumjtqfppdsfu/config/auth" -Method Patch -Headers $headers -Body $body
    Write-Host "SUCCESS: OTP length set to 6"
    Write-Host ($res | ConvertTo-Json)
} catch {
    Write-Host "REST API Exception:" $_.Exception.Message
}
