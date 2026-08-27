param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [Parameter(Mandatory = $true)]
    [int] $PostId,

    [Parameter(Mandatory = $true)]
    [string] $PublicUrl,

    [Parameter(Mandatory = $true)]
    [string] $Username,

    [Parameter(Mandatory = $true)]
    [string] $ApplicationPassword,

    [Parameter(Mandatory = $true)]
    [int] $ExampleIndex
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$examplesPath = Join-Path $PSScriptRoot '..\..\..\block-examples.json'
$examples = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $examplesPath)) | ConvertFrom-Json
if ($ExampleIndex -lt 0 -or $ExampleIndex -ge $examples.Count) {
    throw "ExampleIndex must be between 0 and $($examples.Count - 1)."
}

$document = $examples[$ExampleIndex]
$documentJson = $document | ConvertTo-Json -Depth 100 -Compress
$route = "$BaseUrl/index.php?rest_route=/code-to-block/v1/pages/$PostId/block-tree"
$token = [Convert]::ToBase64String(
    [Text.Encoding]::ASCII.GetBytes("${Username}:${ApplicationPassword}")
)
$headers = @{ Authorization = "Basic $token" }

$saved = Invoke-RestMethod `
    -Uri $route `
    -Method Post `
    -Headers $headers `
    -ContentType 'application/json' `
    -Body $documentJson
$loaded = Invoke-RestMethod -Uri $route -Method Get -Headers $headers

function ConvertTo-CanonicalJson {
    param([object] $Value)
    return $Value | ConvertTo-Json -Depth 100 -Compress
}

$expectedJson = ConvertTo-CanonicalJson $document
if ((ConvertTo-CanonicalJson $saved) -cne $expectedJson) {
    throw 'The save response differs from the submitted example.'
}
if ((ConvertTo-CanonicalJson $loaded) -cne $expectedJson) {
    throw 'The loaded example differs from the submitted example.'
}

$page = Invoke-WebRequest -Uri $PublicUrl -UseBasicParsing
if ($page.Content -notmatch "id=[`"']ctb-page-$PostId[`"']") {
    throw 'The public page does not contain the rendered block-tree wrapper.'
}

$stylesheetPattern = "href=[`"'](?<url>[^`"']*ctb-page-$PostId-[a-f0-9]{16}\.css[^`"']*)[`"']"
if ($page.Content -notmatch $stylesheetPattern) {
    throw 'The public page does not enqueue a content-hashed stylesheet.'
}

$stylesheetUrl = $Matches.url -replace '&amp;', '&'
if ($stylesheetUrl.StartsWith('/')) {
    $stylesheetUrl = $BaseUrl + $stylesheetUrl
}
$stylesheet = Invoke-WebRequest -Uri $stylesheetUrl -UseBasicParsing
if ($stylesheet.Content -notmatch "#ctb-page-$PostId \.ctb-block-0\{") {
    throw 'The generated stylesheet does not contain the scoped root rule.'
}

"PASS: example $ExampleIndex saved, loaded, rendered publicly, and served content-hashed CSS."
