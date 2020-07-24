/*
 * window.mozRTCPeerConnection, window.mozRTCSessionDescription, window.mozRTCIceCandidate are now deprecated
 */

RTCPeerConnection = window.RTCPeerConnection || /*window.mozRTCPeerConnection ||*/ window.webkitRTCPeerConnection;
RTCSessionDescription = /*window.mozRTCSessionDescription ||*/ window.RTCSessionDescription;
RTCIceCandidate = /*window.mozRTCIceCandidate ||*/ window.RTCIceCandidate;
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia;

function signal(url, onStream, onError, onClose, onMessage) {
    if ("WebSocket" in window) {
        console.log("opening web socket: " + url);
        var ws = new WebSocket(url);
        var pc;
        var iceCandidates = [];
        var hasRemoteDesc = false;

        function addIceCandidates() {
            if (hasRemoteDesc) {
                iceCandidates.forEach(function (candidate) {
                    pc.addIceCandidate(candidate,
                        function () {
                            console.log("IceCandidate added: " + JSON.stringify(candidate));
                        },
                        function (error) {
                            console.error("addIceCandidate error: " + error);
                        }
                    );
                });
                iceCandidates = [];
            }
        }


        ws.onopen = function () {
            /* First we create a peer connection */
            var config = {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]};
            var options = {optional: []};
            pc = new RTCPeerConnection(config, options);
            iceCandidates = [];
            hasRemoteDesc = false;

            pc.onicecandidate = function (event) {
                if (event.candidate) {
                    var candidate = {
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        sdpMid: event.candidate.sdpMid,
                        candidate: event.candidate.candidate
                    };
                    var request = {
                        what: "addIceCandidate",
                        data: JSON.stringify(candidate)
                    };
                    ws.send(JSON.stringify(request));
                } else {
                    console.log("end of candidates.");
                }
            };

            if ('ontrack' in pc) {
                pc.ontrack = function (event) {
                    onStream(event.streams[0]);
                };
            } else {  // onaddstream() deprecated
                pc.onaddstream = function (event) {
                    onStream(event.stream);
                };
            }

            pc.onremovestream = function (event) {
                console.log("the stream has been removed: do your stuff now");
            };

            // pc.ondatachannel = function (event) {
            //     console.log("a data channel is available: do your stuff with it");
            //     // For an example, see https://www.linux-projects.org/uv4l/tutorials/webrtc-data-channels/
            // };
            pc.ondatachannel = onDataChannel
            /* kindly signal the remote peer that we would like to initiate a call */
            var request = {
                what: "call",
                options: {
                    // check https://www.linux-projects.org/documentation/uv4l-server/ for more setting
                    // 10 for 320×240-30fps,
                    // 20 for 352×288-30fps,
                    // 30 for 640×480-30fps,
                    // 40 for 960×720-30fps,
                    // 50 for 1024×768-30fps,
                    // 60 for 1280×720-30fps,
                    // 63 for 1280×720-60fps,
                    // 65 for 1280×768-15fps,
                    // 70 for 1280×768-30fps,
                    // 80 for 1280×960-30fps,
                    // 90 for 1600×768-30fps,
                    // 95 for 1640×1232-15fps,
                    // 97 for 1640×1232-30fps,
                    // 100 for 1920×1080-15fps,
		    // 105 for 1920×1080-30fps
                    // If forced, the hardware codec depends on the arch.
                    // (e.g. it's H264 on the Raspberry Pi)
                    // Make sure the browser supports the codec too.
                    force_hw_vcodec: document.getElementById("remote_hw_vcodec").checked,
                    vformat: 60, /* 30=640x480, 30 fps. 60=1280x720, 30 fps. */
                    trickle_ice: true
                }
            };
            console.log("send message " + JSON.stringify(request));
            ws.send(JSON.stringify(request));
        };

        ws.onmessage = function (evt) {
            var msg = JSON.parse(evt.data);
            var what = msg.what;
            var data = msg.data;

            console.log("received message " + JSON.stringify(msg));

            switch (what) {
                case "offer":
                    var mediaConstraints = {
                        optional: [],
                        mandatory: {
                            OfferToReceiveAudio: true,
                            OfferToReceiveVideo: true
                        }
                    };
                    pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)),
                            function onRemoteSdpSuccess() {
                                hasRemoteDesc = true;
                                addIceCandidates();
                                pc.createAnswer(function (sessionDescription) {
                                    pc.setLocalDescription(sessionDescription);
                                    var request = {
                                        what: "answer",
                                        data: JSON.stringify(sessionDescription)
                                    };
                                    ws.send(JSON.stringify(request));
                                }, function (error) {
                                    onError("failed to create answer: " + error);
                                }, mediaConstraints);
                            },
                            function onRemoteSdpError(event) {
                                onError('failed to set the remote description: ' + event);
                                ws.close();
                            }
                    );

                    break;

                case "answer":
                    break;

                case "message":
                    if (onMessage) {
                        onMessage(msg.data);
                    }
                    break;

                case "iceCandidate": // received when trickle ice is used (see the "call" request)
                    if (!msg.data) {
                        console.log("Ice Gathering Complete");
                        break;
                    }
                    var elt = JSON.parse(msg.data);
                    let candidate = new RTCIceCandidate({sdpMLineIndex: elt.sdpMLineIndex, candidate: elt.candidate});
                    iceCandidates.push(candidate);
                    addIceCandidates(); // it internally checks if the remote description has been set
                    break;

                case "iceCandidates": // received when trickle ice is NOT used (see the "call" request)
                    var candidates = JSON.parse(msg.data);
                    for (var i = 0; candidates && i < candidates.length; i++) {
                        var elt = candidates[i];
                        let candidate = new RTCIceCandidate({sdpMLineIndex: elt.sdpMLineIndex, candidate: elt.candidate});
                        iceCandidates.push(candidate);
                    }
                    addIceCandidates();
                    break;
            }
        };

        ws.onclose = function (event) {
            console.log('socket closed with code: ' + event.code);
            if (pc) {
                pc.close();
                pc = null;
                ws = null;
            }
            if (onClose) {
                onClose();
            }
        };

        ws.onerror = function (event) {
            onError("An error has occurred on the websocket (make sure the address is correct)!");
        };

        this.hangup = function() {
            if (ws) {
                var request = {
                    what: "hangup"
                };
                console.log("send message " + JSON.stringify(request));
                ws.send(JSON.stringify(request));
            }
        };

    } else {
        onError("Sorry, this browser does not support Web Sockets. Bye.");
    }
}

// controller
datachannel = null;

function onDataChannel(event) {
    console.log("onDataChannel()");
    datachannel = event.channel;

    event.channel.onopen = function () {
        console.log("Data Channel is open!");
        //document.getElementById('datachannels').disabled = false;
    };

    event.channel.onerror = function (error) {
        console.error("Data Channel Error:", error);
    };

    event.channel.onmessage = function (event) {
        console.log("Got Data Channel Message:", event.data);
    };

    event.channel.onclose = function () {
        datachannel = null;
        console.log("The Data Channel is Closed");
    };
}

function stop() {
    if (datachannel) {
        console.log("closing data channels");
        datachannel.close();
        datachannel = null;
    }
}

function send_message(msg) {
    datachannel.send(msg);
    console.log("message sent: ", msg);
}

var commands = [];

function sendCommands(){
    console.log(JSON.stringify({commands: commands}));
    send_message(JSON.stringify({commands: commands}));
}

function mousedown(e) {
    commands = e;
    sendCommands();
}

function mouseup(e) {
    commands = e;
    sendCommands();
}

//Forward button
window.addEventListener('DOMContentLoaded', function () {
    var forward = document.getElementById('forward');
    var backward = document.getElementById('backward');
    var left = document.getElementById('left');
    var right = document.getElementById('right');

    forward.addEventListener('touchstart', e => mousedown('FORWARD'), false);
    forward.addEventListener('mousedown', e => mousedown('FORWARD'), false);
    forward.addEventListener('touchend', e => mouseup('false'), false);
    forward.addEventListener('mouseup', e => mouseup('false'), false);
    /*
    forward.on('touchstart click', e => mousedown('FORWARD'));
    forward.on('touchend click', e => mouseup('false'));
    forward.addEventListener('mousedown', e => mousedown('FORWARD'));
    forward.addEventListener('mouseup', e => mouseup('false'));
    */

    //backward button

    backward.addEventListener('touchstart', e => mousedown('BACKWARD'), false);
    backward.addEventListener('mousedown', e => mousedown('BACKWARD'), false);
    backward.addEventListener('touchend', e => mouseup('false'), false);
    backward.addEventListener('mouseup', e => mouseup('false'), false);
    /*
    backward.on('touchstart click', mousedown('BACKWARD'));
    backward.on('touchend click', mouseup('false'));
    backward.addEventListener('mousedown', e => mousedown('BACKWARD'));
    backward.addEventListener('mouseup', e => mouseup('false'));
    */

    //left button

    left.addEventListener('touchstart', e => mousedown('LEFT'), false);
    left.addEventListener('mousedown', e => mousedown('LEFT'), false);
    left.addEventListener('touchend', e => mouseup('false'), false);
    left.addEventListener('mouseup', e => mouseup('false'), false);
    /*
    left.on('touchstart click', mousedown('LEFT'));
    left.on('touchend click', mouseup('false'));
    left.addEventListener('mousedown', e => mousedown('LEFT'));
    left.addEventListener('mouseup', e => mouseup('false'));
    */

    //right button

    right.addEventListener('touchstart', e => mousedown('RIGHT'), false);
    right.addEventListener('mousedown', e => mousedown('RIGHT'), false);
    right.addEventListener('touchend', e => mouseup('false'), false);
    right.addEventListener('mouseup', e => mouseup('false'), false);
    /*
    right.on('touchstart click', mousedown('RIGHT'));
    right.on('touchend click', mouseup('false'));
    right.addEventListener('mousedown', e => mousedown('RIGHT'));
    right.addEventListener('mouseup', e => mouseup('false'));
    */
} );

function singleselection(name, id) {
    var old = document.getElementById(id).checked;
    var elements = document.getElementsByName(name);
    for (var i = 0; i < elements.length; i++) {
        elements[i].checked = false;
    }
    document.getElementById(id).checked = old ? true : false;
}

