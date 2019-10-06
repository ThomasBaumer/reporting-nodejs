# An nodejs webserver for sharing threat intelligence data (part of a master thesis) based on an EOS smart contract
This webserver is part of a master thesis. 
The idea is based on the German "IT-Sicherheitsgesetz" and shall encourage critical infrastructures to share threat intelligence data in a decentralized system.
Implications of game theory and shortcomings in efficiency of a decentralized blockchain are considered.
Note that the code in this repository is used to simulate a system for the master thesis and is not deployed in the wild.

## Getting Started
Clone this repository and startup an EOS node with the smart contract of [that repository](https://github.com/ThomasBaumer/reporting-contract).

Additionally, [Docker](https://www.docker.com/) is a requirement.

After you have started the EOS node, you have to start a mongodb instance by running
```bash
docker run --name mongodb --rm -d -p 27017:27017 -v /path/to/store/data:/data/db mongo --port 27017
```
Now you have to determine the ip addresses of the eos node and the mongodb.

By using docker you can just run 
```bash
docker inspect bridge
```
If you wish to run the eos node or the mongodb on another machine or without docker determine the ip addess as well.

Then you configure the ip addresses of the eos node and the mongodb in the config.json of this repository. 
You can keep the key pairs of the config.json if you want to simulate the system. However, if you want to deploy it seriously, you have to change them (obviously).

Finally to run the webserver use the commands below and access it with your browser via `localhost:8080`.
```bash
docker build -t webserver . 
docker run --name webserver --rm -d -p 8080:8080 -it webserver:latest
```
Have fun! :)

## Contribution
No further implementation is considered since its a master thesis.

## Author
Thomas Baumer

## License
This project is licensed under the MIT License - see the LICENSE file for details

## Acknowledgments
Florian Menges, Benedikt Putz
