// Script shared between MCU and Extender
// Copyright (c)2013 PreSonus Software Ltd.

//////////////////////////////////////////////////////////////////////////////////////////////////
// Definitions
//////////////////////////////////////////////////////////////////////////////////////////////////

const kNumChannels = 8;

const kTrackMode = 0;
const kSendMode = 1;
const kPanMode = 2;
const kPlugMode = 3;
const kFXMode = 4;
const kLastMode = kFXMode;

const kSendSlotAll = 0;
const kSendSlotFirst = 1;

const theTrackParameters = 
[
	{label: "BypAll",	name: "Inserts/bypassAll",	altname: ""},
	{label: "Monitr",	name: "monitor",			altname: ""},
	{label: "Input",	name: "recordPort",			altname: "portAssignmentIn"},
	{label: "Output",	name: "outputPort",			altname: "portAssignmentOut"},
	{label: "S1Byp",	name: "Sends/[0]/sendMute",	altname: ""},
	{label: "S2Byp",	name: "Sends/[1]/sendMute",	altname: ""},
	{label: "S3Byp",	name: "Sends/[2]/sendMute",	altname: ""},
	{label: "S4Byp",	name: "Sends/[3]/sendMute",	altname: ""}	
];

function getFXParamDescriptor (index)
{
	let slotNumber = index + 1;
	return {label: "FX" + slotNumber + "Byp", name: "Inserts/[" + index + "]/@bypass", altname: ""};
}

const kMCUSignal = "MackieControl";
const kAssignmentChanged = "AssignmentChanged";

//////////////////////////////////////////////////////////////////////////////////////////////////
// Assignment
//////////////////////////////////////////////////////////////////////////////////////////////////

function Assignment ()
{
	this.mode = kPanMode;
	this.sendIndex = kSendSlotAll;
	this.flipActive = false;
	this.nameValueMode = 0;
	
	this.sync = function (other)
	{
		this.mode = other.mode;
		this.sendIndex = other.sendIndex;
		this.flipActive = other.flipActive;
		this.nameValueMode = other.nameValueMode;
	}
	
	this.getModeString = function ()
	{
		switch(this.mode)
		{
		case kTrackMode :
			return "TR";
		case kSendMode : 
			return this.sendIndex == kSendSlotAll ? "SE" : "S" + this.sendIndex;
		case kPanMode  :
			return "PN";		
		case kPlugMode :
			return "PL";
		case kFXMode :
			return "FX";
		}
		return "";
	}
	
	this.navigateSends = function (maxSlotCount)
	{
		if(this.mode == kSendMode)
		{		
			this.sendIndex++;
			if(	this.sendIndex >= kSendSlotFirst + kNumChannels ||
				this.sendIndex >= kSendSlotFirst + maxSlotCount)
				this.sendIndex = kSendSlotAll;
		}
		else
		{
			this.mode = kSendMode;
			this.sendIndex = kSendSlotAll;
		}		
	}
	
	this.isSendVisible = function (sendIndex)
	{
		return this.mode == kSendMode && this.sendIndex == sendIndex;
	}
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// ChannelInfo
//////////////////////////////////////////////////////////////////////////////////////////////////

function ChannelInfo ()
{
	this.setLabel = function (element, paramName)
	{
		return element.connectAliasParam (this.labelString, paramName);
	}
	
	this.setConstantLabel = function (text)
	{
		this.constantString.string = text;
		this.labelString.setOriginal (this.constantString);
		return true;
	}
	
	this.setFader = function (element, paramName)
	{
		return element.connectAliasParam (this.faderValue, paramName);
	}
	
	this.setPot = function (element, paramName)
	{
		return element.connectAliasParam (this.potValue, paramName);
	}

	this.setPotSelect = function (element, paramName)
	{
		return element.connectAliasParam (this.potSelectValue, paramName);
	}
		
	this.setValue = function (element, paramName)
	{
		return element.connectAliasParam (this.valueString, paramName);	
	}	
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// BasicMackieHandler
//////////////////////////////////////////////////////////////////////////////////////////////////

BasicMackieHandler = function ()
{
	this.interfaces = [Host.Interfaces.IObserver,
					   Host.Interfaces.IParamObserver];
}

BasicMackieHandler.prototype.onInit = function (surface)
{
	let paramList = surface.paramList;

	// assignment
	this.assignment = new Assignment;
	
	// keep references to surface elements
	let root = surface.model.root;
	let globalMappingElement = root.getGlobalMapping ();
	let genericMappingElement = root.getGenericMapping ();
	let mixerMapping = root.find ("MixerMapping");
	this.channelBankElement = mixerMapping.find ("ChannelBankElement");
	this.focusChannelElement = mixerMapping.find ("FocusBankElement").getElement (0);
	this.focusSendsBankElement = this.focusChannelElement.find ("SendsBankElement");
	this.rootElement = root;
	this.mixerMapping = mixerMapping;
	
	// add alias parameters for faders, vpots, etc.
	this.channels = [];
	for(let i = 0; i < kNumChannels; i++)
	{
		let channelInfo = new ChannelInfo;
		
		channelInfo.faderValue = paramList.addAlias ("faderValue" + i);
		channelInfo.potValue = paramList.addAlias ("potValue" + i);
		channelInfo.potSelectValue = paramList.addAlias ("potSelectValue" + i);
		channelInfo.labelString = paramList.addAlias ("labelString" + i);
		channelInfo.valueString = paramList.addAlias ("valueString" + i);
		channelInfo.constantString = paramList.addString ("constantString" + i);
		
		channelInfo.channelElement = this.channelBankElement.getElement (i);
		channelInfo.sendsBankElement = channelInfo.channelElement.find ("SendsBankElement");		
		channelInfo.plugControlElement = genericMappingElement.getElement (0).find ("vpot[" + i + "]");
		channelInfo.plugControlElement_Vsel = genericMappingElement.getElement (0).find ("vsel[" + i + "]");
		channelInfo.plugControlElement_Fader = genericMappingElement.getElement (0).find ("fader[" + i + "]");

		this.channels.push (channelInfo);
	}

	// register for sync signals
	Host.Signals.advise (kMCUSignal, this);
}

BasicMackieHandler.prototype.onExit = function ()
{
	Host.Signals.unadvise (kMCUSignal, this);
}

BasicMackieHandler.prototype.onConnectChannel = function (channelIndex)
{
	this.updateChannel (channelIndex);
}
		
/*BasicMackieHandler.prototype.onConnectChannelInsert = function (channelIndex, insertIndex)
{
}*/

BasicMackieHandler.prototype.onConnectChannelSend = function (channelIndex, sendIndex)
{
	if(this.assignment.isSendVisible (sendIndex+1))
		this.updateChannel (channelIndex);
}
	
BasicMackieHandler.prototype.onConnectFocusChannel = function ()
{
	if(this.assignment.mode == kTrackMode || this.assignment.mode == kFXMode)
		this.updateAll ();
}

BasicMackieHandler.prototype.onConnectFocusChannelInsert = function (insertIndex)
{
	if(this.assignment.mode == kFXMode)
		this.updateChannel (insertIndex);
}

BasicMackieHandler.prototype.onConnectFocusChannelSend = function (sendIndex)
{
	if(this.assignment.isSendVisible (kSendSlotAll))
		this.updateChannel (sendIndex);
	else if(this.assignment.mode == kTrackMode)
		this.updateAll ();
}

BasicMackieHandler.prototype.onConnectPlugControl = function (index)
{		
	if(this.assignment.mode == kPlugMode)
		this.updateChannel (index);
}

BasicMackieHandler.prototype.updateAll = function ()
{
	for(let i = 0; i < kNumChannels; i++)
		this.updateChannel (i);
}
	
BasicMackieHandler.prototype.updateChannel = function (index)
{
	let channelInfo = this.channels[index];
	let channelElement = channelInfo.channelElement;
	let flipped = this.assignment.flipActive;
	let mode = this.assignment.mode;
	
	if(mode == kPlugMode)
	{
		let plugControlElement = channelInfo.plugControlElement;
		let plugControlElement_Vsel = channelInfo.plugControlElement_Vsel;
		let plugControlElement_Fader = channelInfo.plugControlElement_Fader;
		
		if(flipped)
		{

			if(this.assignment.nameValueMode == 1)
			{
				//NAME Alternate View (Flipped)
				channelInfo.setLabel (plugControlElement_Fader, "title");			
				channelInfo.setValue (plugControlElement, "title");			
			}
			else
			{
				//NAME Standard View (Flipped)
				channelInfo.setLabel (plugControlElement_Fader, "title");
				channelInfo.setValue (plugControlElement_Fader, "value");
			}
			
			//Flipped assigns
			channelInfo.setPot (plugControlElement_Fader, "value");
			channelInfo.setPotSelect (plugControlElement_Vsel,"value");
			channelInfo.setFader (plugControlElement, "value");
		}
		else
		{

			if(this.assignment.nameValueMode == 1)
			{
				//NAME Alternate View (Not flipped)
				channelInfo.setLabel (plugControlElement, "title");			
				channelInfo.setValue (plugControlElement_Fader, "title");		

			}
			else
			{
				//NAME Standard View (Not flipped)
				channelInfo.setLabel (plugControlElement, "title");
				channelInfo.setValue (plugControlElement, "value");
			}

			//Unflipped assigns (Normal)
			channelInfo.setPot (plugControlElement, "value");
			channelInfo.setPotSelect (plugControlElement_Vsel,"value");
			channelInfo.setFader (plugControlElement_Fader, "value");
		}
	}
	else if(mode == kSendMode)
	{
		let sendElement = null;
		let useChannelName = false;
		if(this.assignment.sendIndex == kSendSlotAll)			
			sendElement = this.focusSendsBankElement.getElement (index);
		else
		{
			sendElement = channelInfo.sendsBankElement.getElement (this.assignment.sendIndex-1);
			useChannelName = this.assignment.nameValueMode == 1;
		}
				
		if(useChannelName)
		{
			channelInfo.setLabel (channelElement, "label");
			channelInfo.setValue (sendElement, "sendPort");
		}
		else
		{
			channelInfo.setLabel (sendElement, "sendPort");
			channelInfo.setValue (sendElement, "sendlevel");
		}
			
		if(flipped)
		{				
			channelInfo.setPot (channelElement, "volume");	
			channelInfo.setPotSelect (channelElement, "");	
			channelInfo.setFader (sendElement, "sendlevel");
		}
		else
		{
			channelInfo.setPot (sendElement, "sendlevel");
			channelInfo.setPotSelect (sendElement, "");
			channelInfo.setFader (channelElement, "volume");
		}
	}
	else if(mode == kTrackMode || mode == kFXMode)
	{
		let descriptor = mode == kTrackMode ? theTrackParameters[index] : getFXParamDescriptor (index);
		
		channelInfo.setConstantLabel (descriptor.label);
		
		if(!channelInfo.setValue (this.focusChannelElement, descriptor.name) && descriptor.altname.length > 0)
			channelInfo.setValue (this.focusChannelElement, descriptor.altname);
			
		if(!channelInfo.setPot (this.focusChannelElement, descriptor.name) && descriptor.altname.length > 0)
			channelInfo.setPot (this.focusChannelElement, descriptor.altname);

		if(!channelInfo.setPotSelect (this.focusChannelElement, descriptor.name) && descriptor.altname.length > 0)
			channelInfo.setPotSelect (this.focusChannelElement, descriptor.altname);

		channelInfo.setFader (channelElement, "volume");
	}
	else // kPanMode
	{			
		channelInfo.setLabel (channelElement, "label");
		channelInfo.setValue (channelElement, flipped ? "pan" : "volume");
		channelInfo.setPot (channelElement, flipped ? "volume" : "pan");
		channelInfo.setPotSelect (channelElement, flipped ? "" : "");
		channelInfo.setFader (channelElement, flipped ? "pan" : "volume");
	}
}

BasicMackieHandler.prototype.onSyncAssignment = function (otherAssignment)
{
	this.assignment.sync (otherAssignment);
	this.updateAll ();		
}

// IObserver
BasicMackieHandler.prototype.notify = function (subject, msg)
{
	if(msg.id == kAssignmentChanged)
	{
		let otherId = msg.getArg (0);			
		let thisId = this.rootElement.getPlacementGroup ();
		if(thisId != 0 && thisId == otherId)
		{
			let otherAssignment = msg.getArg (1);
			if(this.assignment != otherAssignment)
				this.onSyncAssignment (otherAssignment);
		}
	}
}

// IParamObserver
BasicMackieHandler.prototype.paramChanged = function (param)
{
}

