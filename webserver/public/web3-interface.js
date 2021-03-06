// Connect to MQTT and listen for transaction requests:
const tryParsingJSON = (str) => {
  let obj;
  try  {
    obj = JSON.parse(str);
  } catch (e) {
    obj = str;
  }
  return obj;
}

class Web3MqttInterface {
  constructor() {
    const clientId = `Web3Mqtt:${Date.now()}:${Math.random()*100}`;
    this.client = new Paho.MQTT.Client("localhost", 8083, clientId);
    this.client.onMessageArrived = this.onMessageArrived.bind(this);
    this.client.onConnectionLost = this.onConnectionLost.bind(this);
    this.client.connect({onSuccess: this.onConnect.bind(this)});

    // Keep track of all getter nodes
    this.nodes = new Map();
  }

  registerNode(payload) {
    this.nodes.set(payload.id, payload);
    if (this.nodes.size == 1) {
      setInterval(this.trackChanges.bind(this), 1000);
    }
  }

  trackChanges() {
    for (const [id, node] of this.nodes) {
      var contractInterface = JSON.parse(node.interface);
      var contract = window.web3.eth.contract(contractInterface);
      var instance = contract.at(node.address);
      instance[node.getter]((err, val) => {
        if (val == null) return;

        if (val != node.val) {
          node.val = val;
          this.nodes.set(node.id, node);
          var message = new Paho.MQTT.Message(JSON.stringify(node));
          message.destinationName = `ethereum/node-updated:${node.id}`;
          this.client.send(message);
        }
      });
    }
  }

  makeTransaction(node) {
      var contractInterface = JSON.parse(node.interface);
      var contract = window.web3.eth.contract(contractInterface);
      var instance = contract.at(node.address);
      instance[node.setter](`${node.payload}`, (...args) => {console.log(args)});
  }

  onConnect() {
    this.client.subscribe("ethereum/make-transaction");
    this.client.subscribe("ethereum/register-node");
  }

  onMessageArrived(msg) {
    const topic = msg.destinationName;

    const payload = tryParsingJSON(msg.payloadString);
    if (topic == "ethereum/make-transaction")
      this.makeTransaction(payload);
    if (topic == "ethereum/register-node")
      this.registerNode(payload);
  }

  onConnectionLost() {
    console.log("Connection lost");
  }
}

new Web3MqttInterface();
