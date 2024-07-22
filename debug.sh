# Setup
# 1. Add 'code' to $PATH
# 2. chmod +x debug.sh

# Compile code
npm run compile

# Run Visual Code with compiled extension (no installation needed)
code --disable-extensions --extensionDevelopmentPath=$(pwd) --extensionDevelopmentPath=$(pwd)
