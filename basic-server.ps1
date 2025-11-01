# Basic HTTP server script with Last-Modified header support

# Create HTTP server
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8080/')
$listener.Start()
Write-Host 'Server started at http://localhost:8080/'
Write-Host 'Live Reload enabled - pages will automatically refresh when files change'

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $requestUrl = $context.Request.Url.LocalPath
        $response = $context.Response
        
        # Handle file requests
        $filePath = Join-Path -Path (Get-Location) -ChildPath $requestUrl.Substring(1)\
        
        if ($requestUrl -eq '/') {
            $filePath = Join-Path -Path (Get-Location) -ChildPath 'index.html'
        }
        
        if (Test-Path -Path $filePath -PathType Leaf) {
            $fileInfo = Get-Item -Path $filePath
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $extension = [System.IO.Path]::GetExtension($filePath)
            
            $contentType = 'application/octet-stream'
            if ($extension -eq '.html') { $contentType = 'text/html' }
            elseif ($extension -eq '.css') { $contentType = 'text/css' }
            elseif ($extension -eq '.js') { $contentType = 'application/javascript' }
            elseif ($extension -eq '.json') { $contentType = 'application/json' }
            elseif ($extension -eq '.png') { $contentType = 'image/png' }
            elseif ($extension -eq '.jpg' -or $extension -eq '.jpeg') { $contentType = 'image/jpeg' }
            elseif ($extension -eq '.gif') { $contentType = 'image/gif' }
            elseif ($extension -eq '.svg') { $contentType = 'image/svg+xml' }
            elseif ($extension -eq '.ico') { $contentType = 'image/x-icon' }
            elseif ($extension -eq '.md') { $contentType = 'text/markdown' }
            
            # Set Last-Modified header for Live Reload functionality
            $lastModified = $fileInfo.LastWriteTime.ToUniversalTime()
            $response.Headers.Add("Last-Modified", $lastModified.ToString("r"))
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
            
            # Add Live Reload script to HTML files
            if ($extension -eq '.html') {
                $htmlContent = [System.Text.Encoding]::UTF8.GetString($content)
                if ($htmlContent -match '</body>') {
                    $liveReloadScript = '<script src="js/live-reload.js"></script>'
                    $htmlWithLiveReload = $htmlContent -replace '</body>', "$liveReloadScript</body>"
                    $content = [System.Text.Encoding]::UTF8.GetBytes($htmlWithLiveReload)
                }
            }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
            Write-Host "200 OK: $requestUrl ($contentType) - Last-Modified: $($lastModified.ToString("r"))"
        } 
        else {
            $response.StatusCode = 404
            Write-Host "404 Not Found: $requestUrl"
        }
        
        $response.Close()
    }
} 
catch {
    Write-Host "Error: $_"
} 
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}