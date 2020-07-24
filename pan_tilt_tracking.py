# USAGE
# python pan_tilt_tracking.py --cascade haarcascade_frontalface_default.xml

# import necessary packages
from multiprocessing import Manager
from multiprocessing import Process
from imutils.video import VideoStream
from pyimagesearch.objcenter import ObjCenter
from pyimagesearch.pid import PID
from pyimagesearch.dialogue import Dialogue
import pantilthat as pth
import numpy as np
import argparse
import signal
import time
import sys
import cv2
from xailient import dnn
#define a blank image to initialize backgorund
prevTilt = 0
prevPan = 0
panAngle = 0
tltAngle = 0
MIN_ACCEPTABLE_ROTATION = 15



# define the range for the motors
servoRangeTilt = (-90, 90)
servoRangePan = (-90, 90)


# function to handle keyboard interrupt
def signal_handler(sig, frame):
    # print a status message
    print("[INFO] You pressed `ctrl + c`! Exiting...")

    # disable the servos
    pth.servo_enable(1, False)
    pth.servo_enable(2, False)

    # exit
    sys.exit()

def obj_center(args, objX, objY, centerX, centerY, toCenter):
    # signal trap to handle keyboard interrupt
    signal.signal(signal.SIGINT, signal_handler)

    # start the video stream and wait for the camera to warm up
    vs = VideoStream(usePiCamera=True).start()
    time.sleep(2.0)
       

    # initialize the object center finder
    obj = ObjCenter(args["cascade"])#,background)

    # loop indefinitely
    while True:
        # grab the frame from the threaded video stream and flip it
        # vertically (since our camera was upside down)
        frame = vs.read()
        frame = cv2.flip(frame, 0)
        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        
        
        
        # calculate the center of the frame as this is where we will
        # try to keep the object
        (H, W) = frame.shape[:2]
        centerX.value = W // 2
        centerY.value = H // 2

        # find the object's location
        objectLoc = obj.update(frame, (centerX.value, centerY.value))
        ((objX.value, objY.value), rect, isReturning) = objectLoc
        
        if isReturning is True:
            toCenter.value = 1
        
            
        # extract the bounding box and draw it
        if rect is not None:
            toCenter.value = 0
            (x, y, w, h) = rect
            cv2.rectangle(frame, (x, y), (x+w,y+h), (0, 255, 0),
                2)
            #draw circle in the center of the box
            frame = cv2.circle(frame, (objX.value,objY.value), radius=1, color=(0, 0, 255), thickness=2)
            frame = cv2.circle(frame, (centerX.value,centerY.value), radius=1, color=(255, 0, 0), thickness=2)


        # display the frame to the screen
        cv2.imshow("Pan-Tilt Face Tracking", frame)
        cv2.waitKey(1)
def dialogue_process(toCenter):
    signal.signal(signal.SIGINT, signal_handler)
    d = Dialogue()
    print("in process dialogue, init class")
    while True:
        if toCenter.value == 0:
            print("to center signal ", toCenter.value)
            d.play()
            print("while in process dialogue")
    

def pid_process(output, p, i, d, objCoord, centerCoord,toCenter):
    # signal trap to handle keyboard interrupt
    signal.signal(signal.SIGINT, signal_handler)

    # create a PID and initialize it
    p = PID(p.value, i.value, d.value)
    p.initialize()

    # loop indefinitely
    while True:
        # calculate the error
        if toCenter.value == 1:
             p.initialize()
            
             
        error = centerCoord.value - objCoord.value
#         if toCenter.value == 1:
#             error = 0
#             objCoord.value = centerCoord.value
        # update the value
        output.value = p.update(error,toCenter.value)
        

def in_range(val, start, end):
    # determine the input vale is in the supplied range
    return (val >= start and val <= end)

def set_servos(pan, tlt, toCenter):
    # signal trap to handle keyboard interrupt
    signal.signal(signal.SIGINT, signal_handler)
    # loop indefinitely
    while True:
        # the pan and tilt angles are reversed
       # prevPan = panAngle
       # prevTilt = tltAngle
        panAngle = -1 * pan.value
        tltAngle = -1 * tlt.value
        if toCenter.value == 1:
            panAngle = 0
            tltAngle = 0
        waitForServo = False
        if abs(panAngle - pth.get_pan()) > MIN_ACCEPTABLE_ROTATION:
            waitForServo = True
            #print("detected suden shift in angle")
         
        if abs(tltAngle - pth.get_tilt()) > MIN_ACCEPTABLE_ROTATION:
            waitForServo = True
            #print("detected suden shift in angle")
        
        
        # if the pan angle is within the range, pan
        if in_range(panAngle, servoRangePan[0], servoRangePan[1]):
           # if abs(prevPan - panAngle) < 60 :
            #    pth.pan(panAngle)
           #else:
           #     pth.pan(int(panAngle/2))
           pth.pan(panAngle)
           #print(panAngle)
        
            

        # if the tilt angle is within the range, tilt
        if in_range(tltAngle, servoRangeTilt[0], servoRangeTilt[1]):
            #if abs(prevTilt - tltAngle) < 60 :
            #    pth.tilt(tltAngle)
            #else:
            #    pth.tilt(int(tltAngle/2))
            pth.tilt(tltAngle)
            #print(tltAngle)
         
        if waitForServo is True:
            time.sleep(0.6)
            print("waiting cuz camera stabilization")  
        time.sleep(0.1)
#         if pth.get_pan() == 0 and pth.get_tilt() == 0:
#             print("to center is 0 now")
#             time.sleep(0.3)
#             #toCenter.value = 0
            

# check to see if this is the main body of execution
if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("-c", "--cascade", type=str, required=True,
        help="path to input Haar cascade for face detection")
    args = vars(ap.parse_args())

    # start a manager for managing process-safe variables
    with Manager() as manager:
        # enable the servos
        pth.servo_enable(1, True)
        pth.servo_enable(2, True)
        
        

        # set integer values for the object center (x, y)-coordinates
        centerX = manager.Value("i", 0)
        centerY = manager.Value("i", 0)

        # set integer values for the object's (x, y)-coordinates
        objX = manager.Value("i", 0)
        objY = manager.Value("i", 0)

        # pan and tilt values will be managed by independed PIDs
        pan = manager.Value("i", 0)
        tlt = manager.Value("i", 0)
        
        #this signal will be used to reset the robot to start state when no faces are seen
        #in a while
        toCenter = manager.Value("i", 1)
        
        

        # set PID values for panning
        #original values 0.09 0.08 0.002
        panP = manager.Value("f", 0.09)
        panI = manager.Value("f", 0.08)
        panD = manager.Value("f", 0.002)

        # set PID values for tilting
        #original 0.11, 0.10 , 0.002
        tiltP = manager.Value("f", 0.11)
        tiltI = manager.Value("f", 0.10)
        tiltD = manager.Value("f", 0.002)

        # we have 4 independent processes
        # 1. objectCenter  - finds/localizes the object
        # 2. panning       - PID control loop determines panning angle
        # 3. tilting       - PID control loop determines tilting angle
        # 4. setServos     - drives the servos to proper angles based
        #                    on PID feedback to keep object in center
        processDialogue = Process(target=dialogue_process, args=(toCenter,))
        processObjectCenter = Process(target=obj_center,
            args=(args, objX, objY, centerX, centerY, toCenter))
        processPanning = Process(target=pid_process,
            args=(pan, panP, panI, panD, objX, centerX,toCenter))
        processTilting = Process(target=pid_process,
            args=(tlt, tiltP, tiltI, tiltD, objY, centerY,toCenter))
        processSetServos = Process(target=set_servos, args=(pan, tlt, toCenter))

        # start all 5 processes
        processDialogue.start()
        processObjectCenter.start()
        processPanning.start()
        processTilting.start()
        processSetServos.start()
        

        # join all 5 processes
        processObjectCenter.join()
        processPanning.join()
        processTilting.join()
        processSetServos.join()
        processDialogue.join()

        # disable the servos
        pth.servo_enable(1, False)
        pth.servo_enable(2, False)


