#!/usr/bin/env bash

# This is an experimental installer script for MagicMirror2 Remote-Control

echo ""
echo "Installation for the MagicMirror2 Remote-Control module started!"
echo ""
echo "Notice: This script and the installed software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software."
echo ""

check_yes() {
    read -p ">>> $1 [y/N]? " -n 1 REPLY
    echo ""
    if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

check_no() {
    read -p ">>> $1 [Y/n]? " -n 1 REPLY
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        return 1
    fi
    return 0
}

if check_yes "Continue?"; then
    echo ""
else
    exit 0
fi

# assume default install location
MM_HOME=$HOME/MagicMirror
MODULE_NAME=MMM-Remote-Control
FORK=Jopyth

# check if we are correct by searching for https://github.com/MichMich/MagicMirror in package.json
TEST_STRING="\"url\": \"git+https://github.com/MichMich/MagicMirror.git\""
if grep -sq "$TEST_STRING" "$MM_HOME/package.json"; then
    # we found it
    echo -n ""
else
    # assume we are in the correct directory
    MM_HOME=`pwd`
    if grep -sq "$TEST_STRING" "$MM_HOME/package.json"; then
        # found it again
        echo -n ""
    else
        echo "Could not find MagicMirror2 installation directory."
        echo "Please start this script again from the MagicMirror directory."
        exit 1
    fi
fi

if [ -d "$MM_HOME/modules/$MODULE_NAME" ] ; then
    # already installed
    echo "Directory $MM_HOME/modules/$MODULE_NAME already exists."
    echo ""

    cd "$MM_HOME/modules/$MODULE_NAME"

    BRANCH="$(git symbolic-ref HEAD 2>/dev/null)" || BRANCH="(unnamed branch)" # detached HEAD

    BRANCH=${BRANCH##refs/heads/}

    echo "You are currently on the $BRANCH branch."
    echo ""
    if [ "$BRANCH" == "master" ]; then
        if check_yes "Do you want to switch to the develop branch?"; then
            git checkout develop
        fi
    else
        if check_yes "Do you want to switch to the master branch?"; then
            git checkout master
        fi
    fi
    echo ""
    if check_no "Do you want to update your branch?"; then
        echo ""
        echo "Pulling changes..."
        git pull
        if [ $? -ne 0 ]; then
            echo "Could not pull successfully."
            exit 1;
        fi
        echo ""
        echo "Checking for new dependencies to install..."
        echo ""
        npm install
        if [ $? -ne 0 ]; then
            echo "Failed to install new dependencies."
            exit 1;
        fi
        echo "Done."
        echo ""
        echo "Update finished!"
    else
        echo "Already installed, not upgrading."
    fi
else
    echo "MagicMirror2 detected in: $MM_HOME"
    echo ""
    if check_yes "Is this correct and do you want to start installation?"; then
            echo ""
            echo "You can use either the master or the develop branch."
            echo "The develop branch contains more features, but is also more likely to cause errors or crashes."
            echo "This can be changed later by executing this script again, or using the git branch command."
            echo ""
            echo "By default the master branch will be installed."
            echo ""
            if check_yes "Do you want to install the develop branch instead?"; then
                BRANCH=develop
            else
                BRANCH=master
            fi

            cd "$MM_HOME/modules"
            echo ""
            echo "Cloning the repository on $BRANCH branch..."
            echo ""
            git clone https://github.com/$FORK/$MODULE_NAME.git -b $BRANCH
            if [ $? -ne 0 ]; then
                echo "Failed. Do you have an internet connection?"
                exit 1;
            fi
            cd $MODULE_NAME

            echo ""
            echo "Installing dependencies..."
            echo ""
            npm install
            if [ $? -ne 0 ]; then
                echo "Failed to install dependencies."
                exit 1;
            fi
            echo "Done."
            echo ""
            echo "Installation finished."
    else
        echo "Installation skipped."
    fi
fi

# Get an UUID to use as an API key
APIKEY=$(/usr/local/bin/node -e 'console.log(require("uuid/v4")().replace(/-/g, ""));');

echo ""
if check_no "Do you want to view instructions on how to configure the module?"; then
    echo "(1) Please add the following snippet into your modules array in your config.js:"
    echo -e "\033[33m    -------------- copy below this line --------------"
    echo -e "    {"
    echo -e "        module: '$MODULE_NAME'"
    echo -e "        // uncomment the following line to show the URL of the remote control on the mirror"
    echo -e "        // , position: 'bottom_left'"
    echo -e "        // you can hide this module afterwards from the remote control itself"
    echo -e "        config: {"
    echo -e "\033[31m            apiKey: '$APIKEY'\033[33m"
    echo -e "        }"
    echo -e "    },"
    echo -e "    -------------- copy above this line --------------\033[0m"
    echo ""
    echo "(2) Also you will need to change the address at which the server listens:"
    echo "    Search for the following line in  your config.js:"
    echo "            address: \"localhost\","
    echo "    and change it to allow any device to contact your Mirror:"
    echo "            address: \"0.0.0.0\","
    echo ""
    echo "(3) Make sure to add the IPs of your devices from which you want to access the Remote Control to the ipWhitelist array."
    echo "    If for example have a phone with the IP address 192.168.0.50 search for the following line:"
    echo "            ipWhitelist: [\"127.0.0.1\", \"::ffff:127.0.0.1\", \"::1\"],"
    echo "    and add your IP to the list:"
    echo "            ipWhitelist: [\"127.0.0.1\", \"::ffff:127.0.0.1\", \"::1\", \"::ffff:192.168.0.50\"],"
    echo "    Alternatively, you can also add multiple devices with IPs such as 192.168.0.XXX:"
    echo "            ipWhitelist: [\"127.0.0.1\", \"::ffff:127.0.0.1\", \"::1\", \"::ffff:192.168.0.1/120\", \"192.168.0.1/24\"],"
    echo ""

    if check_no "Got it?"; then
        echo ""
    else
        echo ""
        echo "Please have a look at the links below for help."
        echo ""
    fi
else
    echo ""
    echo -e "\033[31mYou should also set an API key in your config section!\033[0m"
    echo "  It's dangerous to go alone! Take this. "
    echo -e "\033[31m  apiKey: '$APIKEY'\033[0m"
    echo "  I made it just for you."
    echo ""
fi
echo "Have fun with the module, if you have any problems, please search for help on github or in the forum:"
echo ""
echo "   Github : https://github.com/$FORK/$MODULE_NAME"
echo "   Forum  : http://forum.magicmirror.builders"
echo ""
echo "Do not forget to restart your MagicMirror2 to activate the module! Installation finished."
echo ""
exit 0
