# VS Code Project Skills Loader
# Add this to your PowerShell profile to auto-load project skills

# Load project-specific skills when in the Lyric Chord Composer directory
$projectRoot = "d:\_personal\Lyric-Chord-Composer"
$skillsPath = Join-Path $projectRoot ".vscode\skills.ps1"

if (Test-Path $skillsPath) {
    # Only load if we're in or below the project directory
    $currentPath = Get-Location
    if ($currentPath.Path -like "$projectRoot*" -or $pwd.Path -like "$projectRoot*") {
        . $skillsPath
        Write-Host "Project skills loaded: kill-expo, dev-web" -ForegroundColor Green
    }
}

# Optional: Add to your PowerShell profile ($PROFILE) with:
# . "d:\_personal\Lyric-Chord-Composer\.vscode\init-skills.ps1"
