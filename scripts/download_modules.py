import argparse, os, urllib2, sys, json, re

def get(url):
    try:
        connection = urllib2.urlopen(url)
        content = connection.read()
        connection.close()
        return content
    except urllib2.HTTPError, e:
        print "Error (HTTP)", e.code, url
        sys.exit(1)
    except urllib2.URLError, e:
        print "Error (URL)", e.reason, url
        sys.exit(1)

def makeConsistentName(name):
    short_name = re.sub("mmm?-", "", name, flags=re.IGNORECASE)
    short_name = short_name[0].upper() + short_name[1:]
    short_name = short_name.replace("_", " ").replace("-", " ")
    
    position = short_name.find(" ")
    while position >= 0:
        next_position = position + 1
        short_name = short_name[:next_position] + short_name[next_position].upper() + short_name[next_position + 1:]
        position = short_name.find(" ", next_position)

    short_name = re.sub("([a-z])([A-Z])", "\\1 \\2", short_name)

    return short_name

def parse(content):
    regex = re.compile("- \*\*\[(.*)\]\((.*)\)\*\*.*<br>(.*)")
    matches = re.findall(regex, content)

    module_data_list = []

    for module_author, url, desc in matches:
        name = module_author
        author = module_author
        if (" by " in module_author):
            name, author = module_author.split(" by ")

        # name needs to be normalized later again anyway
        # short_name = makeConsistentName(name)

        url = url.replace("bit.ly/MMM-Instagram", "github.com/kapsolas/MMM-Instagram")
        url = url.replace("bit.ly/MMM-Flickr", "github.com/kapsolas/MMM-Flickr")
        url = url.replace("http:", "https:")
        split_url = url.split("/")[:5]
        identifier = split_url[-2] + "/" + split_url[-1]
        url = "/".join(split_url)

        module_data = {}
        module_data["id"] = identifier
        module_data["longname"] = name
        # module_data["name"] = short_name
        module_data["author"] = author
        module_data["url"] = url
        module_data["desc"] = desc.strip()

        module_data_list.append(module_data)

    # module_data_list = sorted(module_data_list, key=lambda x: x["name"])

    print json.dumps(module_data_list, sort_keys=True, indent=4, separators=(',', ': '))

def main(args):
    content = get(args.url)
    parse(content)
    sys.exit(0)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='command line utility to download current modules')
    parser.add_argument('-u', '--url', nargs='?', default='https://raw.githubusercontent.com/wiki/michmich/MagicMirror/MagicMirror%C2%B2-Modules.md', help='url to extract modules from')
    parser.add_argument('-o', '--outfile', nargs='?', type=argparse.FileType('w'), default=sys.stdout, help='write output to a file (default stdout)')
    args = parser.parse_args()

    main(args)
