param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [Parameter(Mandatory = $true)]
    [int] $PostId,

    [Parameter(Mandatory = $true)]
    [string] $Username,

    [Parameter(Mandatory = $true)]
    [string] $ApplicationPassword,

    [string] $Fixture = ''
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
if ('' -eq $Fixture) {
    $Fixture = Join-Path $PSScriptRoot 'fixtures\round-trip.json'
}
$route = "$BaseUrl/index.php?rest_route=/code-to-block/v1/pages/$PostId/block-tree"
$token = [Convert]::ToBase64String(
    [Text.Encoding]::ASCII.GetBytes("${Username}:${ApplicationPassword}")
)
$headers = @{ Authorization = "Basic $token" }
$fixtureJson = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $Fixture))
$expected = $fixtureJson | ConvertFrom-Json

function ConvertTo-CanonicalJson {
    param([object] $Value)
    return $Value | ConvertTo-Json -Depth 100 -Compress
}

$saved = Invoke-RestMethod `
    -Uri $route `
    -Method Post `
    -Headers $headers `
    -ContentType 'application/json' `
    -Body $fixtureJson

$loaded = Invoke-RestMethod -Uri $route -Method Get -Headers $headers

$expectedJson = ConvertTo-CanonicalJson $expected
if ((ConvertTo-CanonicalJson $saved) -cne $expectedJson) {
    throw 'The save response differs from the submitted block tree.'
}
if ((ConvertTo-CanonicalJson $loaded) -cne $expectedJson) {
    throw 'The loaded block tree differs from the submitted block tree.'
}

try {
    Invoke-RestMethod -Uri $route -Method Get | Out-Null
    throw 'The load route allowed an unauthenticated request.'
} catch {
    if ($_.Exception.Response.StatusCode.value__ -notin 401, 403) {
        throw
    }
}

try {
    Invoke-RestMethod `
        -Uri $route `
        -Method Post `
        -ContentType 'application/json' `
        -Body $fixtureJson | Out-Null
    throw 'The save route allowed an unauthenticated request.'
} catch {
    if ($_.Exception.Response.StatusCode.value__ -notin 401, 403) {
        throw
    }
}

try {
    Invoke-RestMethod `
        -Uri $route `
        -Method Post `
        -Headers $headers `
        -ContentType 'application/json' `
        -Body '{}' | Out-Null
    throw 'The save route accepted an invalid block tree.'
} catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 400) {
        throw
    }
}

$loadedAfterRejection = Invoke-RestMethod -Uri $route -Method Get -Headers $headers
if ((ConvertTo-CanonicalJson $loadedAfterRejection) -cne $expectedJson) {
    throw 'A rejected save changed the previously stored block tree.'
}

$malicious = $fixtureJson | ConvertFrom-Json
$malicious.root.children[0].tag = 'a'
$malicious.root.children[0].attributes = [pscustomobject]@{
    href = " java`nscript:alert(1)"
    onclick = 'alert(1)'
    target = '_BLANK'
}
$maliciousJson = ConvertTo-CanonicalJson $malicious
$maliciousSaved = Invoke-RestMethod `
    -Uri $route `
    -Method Post `
    -Headers $headers `
    -ContentType 'application/json' `
    -Body $maliciousJson
$savedAttributeNames = @($maliciousSaved.root.children[0].attributes.PSObject.Properties.Name)
if ($savedAttributeNames -contains 'href' -or $savedAttributeNames -contains 'onclick') {
    throw 'The save route retained a script URL or event-handler attribute.'
}

$restored = Invoke-RestMethod `
    -Uri $route `
    -Method Post `
    -Headers $headers `
    -ContentType 'application/json' `
    -Body $fixtureJson
if ((ConvertTo-CanonicalJson $restored) -cne $expectedJson) {
    throw 'The valid fixture could not be restored after malicious-attribute testing.'
}

$unsafeCss = $fixtureJson | ConvertFrom-Json
$unsafeCss.root.styles.custom_css_fallback = 'width: expression(alert(1));'
try {
    Invoke-RestMethod `
        -Uri $route `
        -Method Post `
        -Headers $headers `
        -ContentType 'application/json' `
        -Body (ConvertTo-CanonicalJson $unsafeCss) | Out-Null
    throw 'The save route accepted active CSS syntax.'
} catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 400) {
        throw
    }
}

try {
    Invoke-RestMethod `
        -Uri $route `
        -Method Post `
        -Headers $headers `
        -ContentType 'application/json' `
        -Body ('x' * (2 * 1024 * 1024 + 1)) | Out-Null
    throw 'The save route accepted a request larger than 2 MB.'
} catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 413) {
        throw
    }
}

$loadedAfterSecurityTests = Invoke-RestMethod -Uri $route -Method Get -Headers $headers
if ((ConvertTo-CanonicalJson $loadedAfterSecurityTests) -cne $expectedJson) {
    throw 'Rejected security payloads changed the valid stored tree.'
}

"PASS: authenticated round trip, GET/POST authorization, malicious attributes, active CSS, size limits, and rejected-write preservation."
